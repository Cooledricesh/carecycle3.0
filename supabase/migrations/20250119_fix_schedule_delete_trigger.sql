-- Fix trigger to prevent foreign key violation during DELETE operations
-- The trigger was trying to INSERT deleted schedule_id into logs, causing FK violation

CREATE OR REPLACE FUNCTION public.log_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only log UPDATE operations
    -- Skip DELETE to avoid foreign key violations
    IF TG_OP = 'UPDATE' THEN
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
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Don't log DELETE operations to avoid FK violations
        -- The schedule is being deleted, so we can't reference it
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;