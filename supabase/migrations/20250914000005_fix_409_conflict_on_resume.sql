-- Fix 409 Conflict error when resuming schedules
-- The trigger was causing conflicts by trying to modify data during the update
-- Also fixes potential duplicate trigger execution by removing both possible trigger names

BEGIN;

-- Drop any existing triggers with both possible names to prevent duplicates
DROP TRIGGER IF EXISTS on_schedule_state_change ON schedules;
DROP TRIGGER IF EXISTS trigger_schedule_state_change ON schedules;

-- Create a simpler version that doesn't cause conflicts
CREATE OR REPLACE FUNCTION handle_schedule_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log the state change
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
        'status_change',
        jsonb_build_object('status', OLD.status, 'next_due_date', OLD.next_due_date),
        jsonb_build_object('status', NEW.status, 'next_due_date', NEW.next_due_date),
        NOW(),
        auth.uid()
    );

    -- For status changes from paused to active, handle in async/deferred manner
    -- The application layer will handle creating executions and notifications
    -- This prevents 409 conflicts during the update transaction

    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_schedule_state_change
AFTER UPDATE OF status ON schedules
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_schedule_state_change();

-- Add comment explaining the change
COMMENT ON FUNCTION handle_schedule_state_change() IS
'Simplified trigger to prevent 409 conflicts.
Schedule executions and notifications are now handled by the application layer
to avoid transaction conflicts during status updates.';

COMMIT;