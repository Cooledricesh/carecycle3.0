-- Complete fix for schedule pause/resume flow
-- This migration combines enum fixes and trigger improvements

BEGIN;

-- =====================================================
-- 1. Fix notification_state enum
-- =====================================================

-- First, add 'cancelled' to notification_state if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'cancelled'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_state'
        )
    ) THEN
        ALTER TYPE notification_state ADD VALUE IF NOT EXISTS 'cancelled';
    END IF;
END
$$;

-- =====================================================
-- 2. Re-create the state change handler with proper enum handling
-- =====================================================

DROP TRIGGER IF EXISTS trigger_schedule_state_change ON schedules;
DROP FUNCTION IF EXISTS handle_schedule_state_change() CASCADE;

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
    IF OLD.status IS DISTINCT FROM NEW.status THEN
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
            jsonb_build_object('status', OLD.status::text, 'next_due_date', OLD.next_due_date),
            jsonb_build_object('status', NEW.status::text, 'next_due_date', NEW.next_due_date),
            auth.uid(),
            NOW(),
            COALESCE(NEW.notes, 'Status changed via trigger')
        );
    END IF;

    -- Handle pause transition (active -> paused)
    IF OLD.status = 'active' AND NEW.status = 'paused' THEN
        -- Cancel all pending notifications (now we can use 'cancelled')
        UPDATE notifications
        SET
            state = 'cancelled',
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
            state = 'cancelled',
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

-- Create the trigger
CREATE TRIGGER trigger_schedule_state_change
AFTER UPDATE ON schedules
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_schedule_state_change();

-- =====================================================
-- 3. Update existing 'failed' notifications that should be 'cancelled'
-- =====================================================

-- Update notifications that were marked as 'failed' due to pause/cancel
UPDATE notifications
SET state = 'cancelled'
WHERE state = 'failed'
  AND error_message IN ('Schedule paused', 'Schedule cancelled', 'Notification date passed');

-- =====================================================
-- 4. Add helpful comments
-- =====================================================

COMMENT ON TYPE notification_state IS
'Notification states: pending (대기중), ready (준비됨), sent (발송됨), failed (실패), cancelled (취소됨)';

COMMENT ON FUNCTION handle_schedule_state_change() IS
'Handles schedule state transitions (pause/resume/cancel) with proper data synchronization.
Automatically skips executions and cancels notifications when pausing.
Creates new executions and notifications when resuming.
Now properly uses the cancelled state for notifications.';

COMMIT;