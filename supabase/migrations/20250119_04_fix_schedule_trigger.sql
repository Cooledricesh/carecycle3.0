-- Fix trigger to prevent foreign key violation during DELETE operations
-- The trigger should only fire on UPDATE, not DELETE

-- First, update the function to handle only UPDATE operations
CREATE OR REPLACE FUNCTION public.log_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures consistent permissions
SET search_path = pg_catalog, public -- Fixed search path for security
AS $function$
BEGIN
    -- Only log UPDATE operations
    -- DELETE operations are skipped to avoid FK violations
    -- since the schedule being deleted can't be referenced in logs
    IF TG_OP = 'UPDATE' THEN
        BEGIN
            -- Use fully qualified table name for security
            INSERT INTO public.schedule_logs (
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

-- Security hardening: Set function ownership and revoke unnecessary privileges
-- Note: In Supabase, these commands might need to be run separately by an admin
DO $$
BEGIN
    -- Change function owner to postgres (superuser)
    -- This ensures the function runs with appropriate privileges
    ALTER FUNCTION public.log_schedule_changes() OWNER TO postgres;

    -- Revoke EXECUTE from PUBLIC to minimize attack surface
    REVOKE EXECUTE ON FUNCTION public.log_schedule_changes() FROM PUBLIC;

    -- Grant EXECUTE only to authenticated users who need it
    -- In Supabase, authenticated role typically needs this
    GRANT EXECUTE ON FUNCTION public.log_schedule_changes() TO authenticated;

    RAISE NOTICE 'Function security settings applied successfully';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to change function ownership/permissions. These commands should be run by a database administrator.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not apply all security settings: %', SQLERRM;
END $$;