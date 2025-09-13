-- Fix schedule pause/resume flow with proper data synchronization
-- This migration adds proper handling for state transitions and data consistency

BEGIN;

-- =====================================================
-- 1. Drop existing trigger if exists
-- =====================================================
DROP TRIGGER IF EXISTS trigger_schedule_state_change ON schedules;
DROP FUNCTION IF EXISTS handle_schedule_state_change() CASCADE;

-- =====================================================
-- 2. Create improved state change handler function
-- =====================================================
CREATE OR REPLACE FUNCTION handle_schedule_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_execution_count INTEGER;
    v_notification_count INTEGER;
BEGIN
    -- Log state transition
    IF OLD.status != NEW.status THEN
        INSERT INTO schedule_logs (
            schedule_id,
            action,
            old_values,
            new_values,
            changed_by,
            changed_at,
            reason
        ) VALUES (
            NEW.id,
            'status_change',
            jsonb_build_object('status', OLD.status, 'next_due_date', OLD.next_due_date),
            jsonb_build_object('status', NEW.status, 'next_due_date', NEW.next_due_date),
            auth.uid(),
            NOW(),
            COALESCE(NEW.notes, 'Status changed via trigger')
        );
    END IF;

    -- Handle pause transition (active -> paused)
    IF OLD.status = 'active' AND NEW.status = 'paused' THEN
        -- Cancel all pending notifications
        UPDATE notifications
        SET
            state = 'failed', -- Use 'failed' as 'cancelled' doesn't exist yet
            updated_at = NOW(),
            error_message = 'Schedule paused'
        WHERE
            schedule_id = NEW.id
            AND state IN ('pending', 'ready');

        GET DIAGNOSTICS v_notification_count = ROW_COUNT;

        -- Skip all planned executions
        UPDATE schedule_executions
        SET
            status = 'skipped',
            skipped_reason = 'Schedule paused by user',
            updated_at = NOW()
        WHERE
            schedule_id = NEW.id
            AND status = 'planned';

        GET DIAGNOSTICS v_execution_count = ROW_COUNT;

        -- Log the impact
        RAISE NOTICE 'Schedule % paused: % executions skipped, % notifications cancelled',
            NEW.id, v_execution_count, v_notification_count;
    END IF;

    -- Handle resume transition (paused -> active)
    IF OLD.status = 'paused' AND NEW.status = 'active' THEN
        -- Validate next_due_date was updated
        IF OLD.next_due_date = NEW.next_due_date THEN
            RAISE WARNING 'Resume without next_due_date update detected for schedule %', NEW.id;
        END IF;

        -- Create new execution for the updated next_due_date
        INSERT INTO schedule_executions (
            schedule_id,
            planned_date,
            status,
            created_at
        ) VALUES (
            NEW.id,
            NEW.next_due_date,
            'planned',
            NOW()
        ) ON CONFLICT (schedule_id, planned_date)
        DO UPDATE SET
            status = 'planned',
            skipped_reason = NULL,
            updated_at = NOW();

        -- Create notification if required
        IF NEW.requires_notification AND NEW.notification_days_before > 0 THEN
            INSERT INTO notifications (
                schedule_id,
                recipient_id,
                channel,
                notify_date,
                state,
                title,
                message,
                created_at
            ) VALUES (
                NEW.id,
                COALESCE(NEW.assigned_nurse_id, NEW.created_by),
                'dashboard',
                (NEW.next_due_date - (NEW.notification_days_before || ' days')::interval)::date,
                'pending',
                '일정 알림',
                format('일정이 %s일 후 도래합니다.', NEW.notification_days_before),
                NOW()
            ) ON CONFLICT DO NOTHING;
        END IF;

        RAISE NOTICE 'Schedule % resumed with next_due_date: %', NEW.id, NEW.next_due_date;
    END IF;

    -- Handle cancellation (any -> cancelled)
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        -- Cancel all pending notifications
        UPDATE notifications
        SET
            state = 'failed', -- Use 'failed' as 'cancelled' doesn't exist yet
            updated_at = NOW(),
            error_message = 'Schedule cancelled'
        WHERE
            schedule_id = NEW.id
            AND state IN ('pending', 'ready');

        -- Skip all planned executions
        UPDATE schedule_executions
        SET
            status = 'skipped',
            skipped_reason = 'Schedule cancelled',
            updated_at = NOW()
        WHERE
            schedule_id = NEW.id
            AND status = 'planned';
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. Create trigger for state changes
-- =====================================================
CREATE TRIGGER trigger_schedule_state_change
AFTER UPDATE ON schedules
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_schedule_state_change();

-- =====================================================
-- 4. Update calculate_next_due_date to skip paused schedules
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_next_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule RECORD;
BEGIN
    -- Only process when execution is completed
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- Get the schedule details
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;

        -- Skip if schedule is not active
        IF v_schedule.status != 'active' THEN
            RAISE NOTICE 'Skipping next_due_date calculation for non-active schedule %', NEW.schedule_id;
            RETURN NEW;
        END IF;

        -- Calculate next due date based on EXECUTED date
        UPDATE schedules
        SET
            next_due_date = NEW.executed_date + (COALESCE(interval_weeks, 0) * 7 || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;

        -- Create notification for long-interval schedules
        IF v_schedule.interval_weeks >= 4 AND v_schedule.requires_notification THEN
            INSERT INTO notifications (
                schedule_id,
                recipient_id,
                channel,
                notify_date,
                title,
                message
            ) VALUES (
                NEW.schedule_id,
                COALESCE(v_schedule.assigned_nurse_id, v_schedule.created_by),
                'dashboard'::notification_channel,
                (NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval -
                 (v_schedule.notification_days_before || ' days')::interval)::date,
                '일정 알림',
                format('예정된 일정이 %s일 후 도래합니다.', v_schedule.notification_days_before)
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. Add helper function to validate schedule resume
-- =====================================================
CREATE OR REPLACE FUNCTION validate_schedule_resume(
    p_schedule_id UUID,
    p_new_next_due_date DATE
)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT,
    warnings TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schedule RECORD;
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_missed_count INTEGER;
BEGIN
    -- Get schedule details
    SELECT * INTO v_schedule FROM schedules WHERE id = p_schedule_id;

    -- Check if schedule exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'Schedule not found',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if schedule is paused
    IF v_schedule.status != 'paused' THEN
        RETURN QUERY SELECT
            FALSE,
            'Schedule is not paused',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if new date is in the past
    IF p_new_next_due_date < CURRENT_DATE THEN
        RETURN QUERY SELECT
            FALSE,
            'Next due date cannot be in the past',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if new date exceeds end date
    IF v_schedule.end_date IS NOT NULL AND p_new_next_due_date > v_schedule.end_date THEN
        RETURN QUERY SELECT
            FALSE,
            'Next due date exceeds schedule end date',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Calculate missed executions
    SELECT COUNT(*) INTO v_missed_count
    FROM generate_series(
        v_schedule.next_due_date,
        CURRENT_DATE,
        (v_schedule.interval_weeks || ' weeks')::interval
    ) AS missed_date
    WHERE missed_date < CURRENT_DATE;

    IF v_missed_count > 0 THEN
        v_warnings := array_append(v_warnings,
            format('%s executions were missed during pause', v_missed_count));
    END IF;

    -- Check if resuming far in the future
    IF p_new_next_due_date > CURRENT_DATE + INTERVAL '3 months' THEN
        v_warnings := array_append(v_warnings,
            'Resuming more than 3 months in the future');
    END IF;

    RETURN QUERY SELECT
        TRUE,
        NULL::TEXT,
        v_warnings;
END;
$$;

-- =====================================================
-- 6. Add function to get pause/resume statistics
-- =====================================================
CREATE OR REPLACE FUNCTION get_schedule_pause_statistics(
    p_schedule_id UUID DEFAULT NULL
)
RETURNS TABLE (
    schedule_id UUID,
    total_pauses INTEGER,
    total_pause_duration_days INTEGER,
    last_pause_date TIMESTAMPTZ,
    last_resume_date TIMESTAMPTZ,
    missed_executions_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH pause_events AS (
        SELECT
            schedule_id,
            changed_at,
            (new_values->>'status')::TEXT AS new_status,
            (old_values->>'status')::TEXT AS old_status,
            LAG(changed_at) OVER (PARTITION BY schedule_id ORDER BY changed_at) AS prev_change
        FROM schedule_logs
        WHERE
            action = 'status_change'
            AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    ),
    pause_periods AS (
        SELECT
            schedule_id,
            COUNT(*) FILTER (WHERE old_status = 'active' AND new_status = 'paused') AS pause_count,
            MAX(CASE WHEN old_status = 'active' AND new_status = 'paused' THEN changed_at END) AS last_pause,
            MAX(CASE WHEN old_status = 'paused' AND new_status = 'active' THEN changed_at END) AS last_resume,
            SUM(
                CASE
                    WHEN old_status = 'paused' AND new_status = 'active'
                    THEN EXTRACT(EPOCH FROM (changed_at - prev_change))/86400
                    ELSE 0
                END
            )::INTEGER AS total_pause_days
        FROM pause_events
        GROUP BY schedule_id
    ),
    missed_stats AS (
        SELECT
            schedule_id,
            COUNT(*) AS missed_count
        FROM schedule_executions
        WHERE
            status = 'skipped'
            AND skipped_reason LIKE '%pause%'
            AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
        GROUP BY schedule_id
    )
    SELECT
        COALESCE(pp.schedule_id, ms.schedule_id) AS schedule_id,
        COALESCE(pp.pause_count, 0)::INTEGER AS total_pauses,
        COALESCE(pp.total_pause_days, 0)::INTEGER AS total_pause_duration_days,
        pp.last_pause AS last_pause_date,
        pp.last_resume AS last_resume_date,
        COALESCE(ms.missed_count, 0)::INTEGER AS missed_executions_count
    FROM pause_periods pp
    FULL OUTER JOIN missed_stats ms ON pp.schedule_id = ms.schedule_id;
END;
$$;

-- =====================================================
-- 7. Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule_action
ON schedule_logs(schedule_id, action)
WHERE action = 'status_change';

CREATE INDEX IF NOT EXISTS idx_notifications_schedule_state
ON notifications(schedule_id, state)
WHERE state IN ('pending', 'ready');

CREATE INDEX IF NOT EXISTS idx_executions_schedule_status
ON schedule_executions(schedule_id, status)
WHERE status = 'planned';

-- =====================================================
-- 8. Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION handle_schedule_state_change() IS
'Handles schedule state transitions (pause/resume/cancel) with proper data synchronization.
Automatically skips executions and cancels notifications when pausing.
Creates new executions and notifications when resuming.';

COMMENT ON FUNCTION validate_schedule_resume(UUID, DATE) IS
'Validates if a paused schedule can be resumed with the given next_due_date.
Returns validation result with any warnings about missed executions.';

COMMENT ON FUNCTION get_schedule_pause_statistics(UUID) IS
'Returns pause/resume statistics for schedules including total pause duration and missed executions.';

COMMIT;