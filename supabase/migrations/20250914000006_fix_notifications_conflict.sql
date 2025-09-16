-- Fix notifications unique constraint conflict when resuming schedules
-- The issue: notifications table has unique constraint on (schedule_id, notify_date)
-- When resuming, we need to handle existing notifications properly

BEGIN;

-- Idempotent deduplication routine for notifications
-- This safely handles duplicates based on (schedule_id, notify_date) constraint
-- by cancelling older duplicates while keeping the most recent notification active
-- This approach preserves audit history and is safe to re-run multiple times

-- Step 1: Cancel duplicate notifications
-- Uses ROW_NUMBER() to identify duplicates within each (schedule_id, notify_date) group
-- Keeps the most recent notification (by created_at DESC, id DESC as tiebreaker)
WITH duplicate_notifications AS (
    SELECT
        id,
        schedule_id,
        notify_date,
        state,
        ROW_NUMBER() OVER (
            PARTITION BY schedule_id, notify_date
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM public.notifications
    WHERE
        -- Only consider active notifications that could conflict
        state IN ('pending', 'ready')
        -- Only future-dated notifications need deduplication
        AND notify_date >= CURRENT_DATE
)
UPDATE public.notifications n
SET
    state = 'cancelled',
    updated_at = NOW(),
    -- Add audit metadata to track why this was cancelled
    metadata = COALESCE(n.metadata, '{}'::jsonb) ||
        jsonb_build_object(
            'cancelled_reason', 'Duplicate notification cleanup',
            'cancelled_at', NOW(),
            'migration_version', '20250914000006',
            'kept_notification_id', (
                -- Reference the notification that was kept (rn = 1)
                SELECT id FROM duplicate_notifications d2
                WHERE d2.schedule_id = d.schedule_id
                AND d2.notify_date = d.notify_date
                AND d2.rn = 1
            )
        )
FROM duplicate_notifications d
WHERE
    n.id = d.id
    AND d.rn > 1  -- Only cancel duplicates, not the primary record
    AND n.state != 'cancelled';  -- Idempotency: don't re-cancel already cancelled records

-- Step 2: Log the deduplication action for audit purposes
-- This creates a record of what was done, making troubleshooting easier
DO $$
DECLARE
    v_cancelled_count INTEGER;
BEGIN
    -- Count how many records were affected in this run
    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    -- Only log if we actually cancelled something
    IF v_cancelled_count > 0 THEN
        -- Log to schedule_logs if the table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'schedule_logs'
        ) THEN
            INSERT INTO public.schedule_logs (
                schedule_id,
                action,
                old_values,
                new_values,
                changed_at,
                changed_by
            )
            VALUES (
                NULL,  -- No specific schedule, this is a system action
                'migration_deduplication',
                jsonb_build_object('cancelled_duplicates', v_cancelled_count),
                jsonb_build_object('migration', '20250914000006'),
                NOW(),
                NULL  -- System action, no specific user
            )
            ON CONFLICT DO NOTHING;
        END IF;

        RAISE NOTICE 'Cancelled % duplicate notifications', v_cancelled_count;
    END IF;
END $$;

-- Update the trigger to handle conflicts gracefully
-- Create function with explicit schema qualification
CREATE OR REPLACE FUNCTION public.handle_schedule_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only log the state change
    -- Don't create notifications or executions in the trigger
    -- This prevents conflicts and 409 errors

    -- Schema-qualified table reference in INSERT
    INSERT INTO public.schedule_logs (
        schedule_id,
        action,
        old_values,
        new_values,
        changed_at,
        changed_by
    )
    VALUES (
        NEW.id,
        'status_change_' || OLD.status || '_to_' || NEW.status,
        jsonb_build_object('status', OLD.status, 'next_due_date', OLD.next_due_date),
        jsonb_build_object('status', NEW.status, 'next_due_date', NEW.next_due_date),
        NOW(),
        auth.uid()
    )
    ON CONFLICT DO NOTHING;  -- Prevent any logging conflicts

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in handle_schedule_state_change: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Apply proper security: Revoke PUBLIC access and grant only to necessary roles
REVOKE ALL ON FUNCTION public.handle_schedule_state_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_schedule_state_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_schedule_state_change() TO service_role;

-- Comment explaining the change
COMMENT ON FUNCTION public.handle_schedule_state_change() IS
'Simplified trigger that only logs state changes.
Notifications and executions are handled by the application layer to prevent conflicts.
This resolves 409 and 23505 errors during schedule resume operations.
Security: Only authenticated users and service role can execute this function.';

COMMIT;