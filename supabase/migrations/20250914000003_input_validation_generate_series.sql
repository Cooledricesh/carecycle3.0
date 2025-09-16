-- Add input validation for generate_series calls to prevent NULL and zero interval errors
-- This migration adds safe guards for all generate_series usage in functions

BEGIN;

-- =====================================================
-- 1. Update calculate_next_due_date function with input validation
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
        IF v_schedule.status != 'active'::schedule_status THEN
            RAISE NOTICE 'Skipping next_due_date calculation for non-active schedule %', NEW.schedule_id;
            RETURN NEW;
        END IF;

        -- Validate interval_weeks before using it
        IF v_schedule.interval_weeks IS NULL OR v_schedule.interval_weeks <= 0 THEN
            RAISE WARNING 'Invalid interval_weeks (%) for schedule %. Skipping calculation.',
                v_schedule.interval_weeks, NEW.schedule_id;
            RETURN NEW;
        END IF;

        -- Calculate next due date based on EXECUTED date
        UPDATE schedules
        SET
            next_due_date = NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;

        -- Create notification for long-interval schedules
        IF v_schedule.interval_weeks >= 4
           AND v_schedule.requires_notification
           AND v_schedule.notification_days_before IS NOT NULL
           AND v_schedule.notification_days_before >= 0 THEN

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
            ) ON CONFLICT (schedule_id, notify_date) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 2. Update validate_schedule_resume with enhanced input validation
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
SET search_path = public
AS $$
DECLARE
    v_schedule RECORD;
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_missed_count INTEGER := 0;
BEGIN
    -- Validate input parameters
    IF p_schedule_id IS NULL THEN
        RETURN QUERY SELECT
            FALSE,
            'Schedule ID cannot be NULL',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    IF p_new_next_due_date IS NULL THEN
        RETURN QUERY SELECT
            FALSE,
            'Next due date cannot be NULL',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

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
    IF v_schedule.status != 'paused'::schedule_status THEN
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

    -- Calculate missed executions with comprehensive input validation
    IF v_schedule.next_due_date IS NOT NULL
       AND v_schedule.interval_weeks IS NOT NULL
       AND v_schedule.interval_weeks > 0
       AND v_schedule.next_due_date <= CURRENT_DATE THEN

        -- Safe generate_series call with validated inputs
        BEGIN
            SELECT COUNT(*) INTO v_missed_count
            FROM generate_series(
                v_schedule.next_due_date,
                CURRENT_DATE,
                (v_schedule.interval_weeks || ' weeks')::interval
            ) AS missed_date
            WHERE missed_date < CURRENT_DATE;
        EXCEPTION
            WHEN OTHERS THEN
                -- If generate_series fails, log the error and continue
                RAISE WARNING 'Could not calculate missed executions for schedule %: %',
                    p_schedule_id, SQLERRM;
                v_missed_count := 0;
        END;

        IF v_missed_count > 0 THEN
            v_warnings := array_append(v_warnings,
                format('%s executions were missed during pause', v_missed_count));
        END IF;
    ELSE
        -- Add warning for invalid interval data
        IF v_schedule.interval_weeks IS NULL OR v_schedule.interval_weeks <= 0 THEN
            v_warnings := array_append(v_warnings,
                'Schedule has invalid interval configuration - missed execution count unavailable');
        END IF;
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
-- 3. Update get_schedule_pause_statistics with input validation
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
SET search_path = public
AS $$
BEGIN
    -- Input validation for schedule_id (if provided)
    IF p_schedule_id IS NOT NULL THEN
        -- Verify the schedule exists
        IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = p_schedule_id) THEN
            RAISE WARNING 'Schedule % not found', p_schedule_id;
            RETURN; -- Return empty result set
        END IF;
    END IF;

    RETURN QUERY
    WITH pause_events AS (
        SELECT
            sl.schedule_id,
            sl.changed_at,
            (sl.new_values->>'status')::TEXT AS new_status,
            (sl.old_values->>'status')::TEXT AS old_status,
            LAG(sl.changed_at) OVER (PARTITION BY sl.schedule_id ORDER BY sl.changed_at) AS prev_change
        FROM schedule_logs sl
        WHERE
            sl.action = 'status_change'
            AND (p_schedule_id IS NULL OR sl.schedule_id = p_schedule_id)
            AND sl.new_values->>'status' IS NOT NULL
            AND sl.old_values->>'status' IS NOT NULL
    ),
    pause_periods AS (
        SELECT
            pe.schedule_id,
            COUNT(*) FILTER (WHERE pe.old_status = 'active' AND pe.new_status = 'paused') AS pause_count,
            MAX(CASE WHEN pe.old_status = 'active' AND pe.new_status = 'paused' THEN pe.changed_at END) AS last_pause,
            MAX(CASE WHEN pe.old_status = 'paused' AND pe.new_status = 'active' THEN pe.changed_at END) AS last_resume,
            COALESCE(SUM(
                CASE
                    WHEN pe.old_status = 'paused'
                         AND pe.new_status = 'active'
                         AND pe.prev_change IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (pe.changed_at - pe.prev_change))/86400
                    ELSE 0
                END
            ), 0)::INTEGER AS total_pause_days
        FROM pause_events pe
        GROUP BY pe.schedule_id
    ),
    missed_stats AS (
        SELECT
            se.schedule_id,
            COUNT(*) AS missed_count
        FROM schedule_executions se
        WHERE
            se.status = 'skipped'::execution_status
            AND se.skipped_reason IS NOT NULL
            AND se.skipped_reason LIKE '%pause%'
            AND (p_schedule_id IS NULL OR se.schedule_id = p_schedule_id)
        GROUP BY se.schedule_id
    )
    SELECT
        COALESCE(pp.schedule_id, ms.schedule_id) AS schedule_id,
        COALESCE(pp.pause_count, 0)::INTEGER AS total_pauses,
        COALESCE(pp.total_pause_days, 0)::INTEGER AS total_pause_duration_days,
        pp.last_pause AS last_pause_date,
        pp.last_resume AS last_resume_date,
        COALESCE(ms.missed_count, 0)::INTEGER AS missed_executions_count
    FROM pause_periods pp
    FULL OUTER JOIN missed_stats ms ON pp.schedule_id = ms.schedule_id
    WHERE COALESCE(pp.schedule_id, ms.schedule_id) IS NOT NULL;
END;
$$;

-- =====================================================
-- 4. Add comprehensive input validation comments
-- =====================================================
COMMENT ON FUNCTION calculate_next_due_date() IS
'Calculates next due date with input validation for interval_weeks to prevent generate_series errors.
Validates interval_weeks is not NULL and greater than 0 before using in calculations.';

COMMENT ON FUNCTION validate_schedule_resume(UUID, DATE) IS
'Validates schedule resume with comprehensive input validation including NULL checks,
safe generate_series usage with exception handling, and interval validation.';

COMMENT ON FUNCTION get_schedule_pause_statistics(UUID) IS
'Returns pause/resume statistics with input validation for schedule existence
and safe handling of NULL values in calculations.';

COMMIT;