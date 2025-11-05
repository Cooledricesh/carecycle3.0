-- Add UNIQUE constraint for notifications table to prevent duplicate notifications
-- This migration prevents duplicate notifications for the same schedule and date

BEGIN;

-- =====================================================
-- 1. Check for and remove existing duplicate notifications
-- =====================================================

-- First, identify and log any existing duplicates
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count existing duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT schedule_id, notify_date, COUNT(*)
        FROM notifications
        WHERE schedule_id IS NOT NULL
        GROUP BY schedule_id, notify_date
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate notification combinations that will be cleaned up', duplicate_count;
    END IF;
END;
$$;

-- Remove duplicate notifications, keeping only the most recent one
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY schedule_id, notify_date
               ORDER BY created_at DESC, id DESC
           ) as rn
    FROM notifications
    WHERE schedule_id IS NOT NULL
)
DELETE FROM notifications
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Log the cleanup action
DO $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    IF cleaned_count > 0 THEN
        RAISE NOTICE 'Cleaned up % duplicate notification records', cleaned_count;
    END IF;
END;
$$;

-- =====================================================
-- 2. Add UNIQUE constraint to prevent future duplicates
-- =====================================================

-- Create unique index for schedule_id and notify_date combination
-- This prevents duplicate notifications for the same schedule on the same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_schedule_date
ON notifications(schedule_id, notify_date)
WHERE schedule_id IS NOT NULL;

-- =====================================================
-- 3. Add partial unique index for execution-based notifications
-- =====================================================

-- Create unique index for execution_id and notify_date combination
-- This prevents duplicate notifications for the same execution
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_execution_date
ON notifications(execution_id, notify_date)
WHERE execution_id IS NOT NULL;

-- =====================================================
-- 4. Update existing functions to handle conflict resolution
-- =====================================================

-- Update the handle_schedule_state_change function to use ON CONFLICT
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
    IF OLD.status = 'active'::schedule_status AND NEW.status = 'paused'::schedule_status THEN
        -- Cancel all pending notifications (now we can use 'cancelled')
        UPDATE notifications
        SET
            state = 'cancelled'::notification_state,
            updated_at = NOW(),
            error_message = 'Schedule paused'
        WHERE
            schedule_id = NEW.id
            AND state IN ('pending'::notification_state, 'ready'::notification_state);

        GET DIAGNOSTICS v_notification_count = ROW_COUNT;

        -- Skip all planned executions
        UPDATE schedule_executions
        SET
            status = 'skipped'::execution_status,
            skipped_reason = 'Schedule paused by user',
            updated_at = NOW()
        WHERE
            schedule_id = NEW.id
            AND status = 'planned'::execution_status;

        GET DIAGNOSTICS v_execution_count = ROW_COUNT;

        RAISE NOTICE 'Schedule % paused: % executions skipped, % notifications cancelled',
            NEW.id, v_execution_count, v_notification_count;
    END IF;

    -- Handle resume transition (paused -> active)
    IF OLD.status = 'paused'::schedule_status AND NEW.status = 'active'::schedule_status THEN
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
            'planned'::execution_status,
            NOW()
        ) ON CONFLICT (schedule_id, planned_date)
        DO UPDATE SET
            status = 'planned'::execution_status,
            skipped_reason = NULL,
            updated_at = NOW();

        -- Create notification if required (with conflict handling)
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
                'dashboard'::notification_channel,
                (NEW.next_due_date - (NEW.notification_days_before || ' days')::interval)::date,
                'pending'::notification_state,
                '일정 알림',
                format('일정이 %s일 후 도래합니다.', NEW.notification_days_before),
                NOW()
            ) ON CONFLICT (schedule_id, notify_date)
            DO UPDATE SET
                state = 'pending'::notification_state,
                updated_at = NOW(),
                error_message = NULL;
        END IF;

        RAISE NOTICE 'Schedule % resumed with next_due_date: %', NEW.id, NEW.next_due_date;
    END IF;

    -- Handle cancellation (any -> cancelled)
    IF NEW.status = 'cancelled'::schedule_status AND OLD.status != 'cancelled'::schedule_status THEN
        -- Cancel all pending notifications
        UPDATE notifications
        SET
            state = 'cancelled'::notification_state,
            updated_at = NOW(),
            error_message = 'Schedule cancelled'
        WHERE
            schedule_id = NEW.id
            AND state IN ('pending'::notification_state, 'ready'::notification_state);

        -- Skip all planned executions
        UPDATE schedule_executions
        SET
            status = 'skipped'::execution_status,
            skipped_reason = 'Schedule cancelled',
            updated_at = NOW()
        WHERE
            schedule_id = NEW.id
            AND status = 'planned'::execution_status;
    END IF;

    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_schedule_state_change ON schedules;
CREATE TRIGGER trigger_schedule_state_change
AFTER UPDATE ON schedules
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_schedule_state_change();

-- =====================================================
-- 5. Add documentation comments
-- =====================================================
COMMENT ON INDEX idx_notifications_unique_schedule_date IS
'Ensures no duplicate notifications for the same schedule on the same date';

COMMENT ON INDEX idx_notifications_unique_execution_date IS
'Ensures no duplicate notifications for the same execution';

COMMIT;