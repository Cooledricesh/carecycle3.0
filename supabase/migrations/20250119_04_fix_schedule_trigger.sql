-- Fix trigger to prevent foreign key violation during DELETE operations
-- The trigger should only fire on UPDATE, not DELETE

-- First, update the function to handle only UPDATE operations
CREATE OR REPLACE FUNCTION public.log_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures consistent permissions
AS $function$
BEGIN
    -- Only log UPDATE operations
    -- DELETE operations are skipped to avoid FK violations
    -- since the schedule being deleted can't be referenced in logs
    IF TG_OP = 'UPDATE' THEN
        BEGIN
            INSERT INTO schedule_logs (
                schedule_id,
                action,
                old_values,
                new_values,
                changed_by
            )
            VALUES (
                NEW.id,
                'UPDATE',
                to_jsonb(OLD),
                to_jsonb(NEW),
                auth.uid()
            );
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                -- This ensures data updates succeed even if logging fails
                RAISE WARNING 'Failed to log schedule change: %', SQLERRM;
        END;
        RETURN NEW;
    END IF;

    -- For any other operation, just return the appropriate record
    -- This should not happen with our trigger definition, but included for safety
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

-- Drop the existing trigger that fires on both UPDATE and DELETE
DROP TRIGGER IF EXISTS trigger_log_schedule_changes ON public.schedules;

-- Create new trigger that only fires on UPDATE
CREATE TRIGGER trigger_log_schedule_changes
AFTER UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.log_schedule_changes();

-- Add a comment explaining the trigger behavior
COMMENT ON TRIGGER trigger_log_schedule_changes ON public.schedules IS
'Logs UPDATE operations on schedules table. DELETE operations are not logged to avoid FK violations.';