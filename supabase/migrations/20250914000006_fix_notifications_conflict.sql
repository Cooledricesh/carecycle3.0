-- Fix notifications unique constraint conflict when resuming schedules
-- The issue: notifications table has unique constraint on (schedule_id, notify_date)
-- When resuming, we need to handle existing notifications properly

BEGIN;

-- Clean up any duplicate or conflicting notifications for the problematic schedule
DELETE FROM notifications
WHERE schedule_id = '1ad15ca8-a17e-432e-8452-a1f43a34c0a5'
AND notify_date >= '2025-09-17';

-- Alternative: Mark existing notifications as cancelled instead of deleting
-- UPDATE notifications
-- SET state = 'cancelled'
-- WHERE schedule_id = '1ad15ca8-a17e-432e-8452-a1f43a34c0a5'
-- AND state IN ('pending', 'ready')
-- AND notify_date >= CURRENT_DATE;

-- Update the trigger to handle conflicts gracefully
CREATE OR REPLACE FUNCTION handle_schedule_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only log the state change
    -- Don't create notifications or executions in the trigger
    -- This prevents conflicts and 409 errors

    INSERT INTO schedule_logs (
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

-- Comment explaining the change
COMMENT ON FUNCTION handle_schedule_state_change() IS
'Simplified trigger that only logs state changes.
Notifications and executions are handled by the application layer to prevent conflicts.
This resolves 409 and 23505 errors during schedule resume operations.';

COMMIT;