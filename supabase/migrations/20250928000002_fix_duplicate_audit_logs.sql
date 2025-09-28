-- ============================================================================
-- Fix Duplicate Audit Logs
-- ============================================================================
-- This migration prevents duplicate audit logs when UPDATE operations
-- don't actually change any values (excluding auto-updated timestamp fields).
-- ============================================================================

-- ============================================================================
-- Improved audit trigger function with change detection
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile public.profiles;
    old_record jsonb;
    new_record jsonb;
    patient_name TEXT;
    item_name TEXT;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

    -- For UPDATE operations, check if there are actual changes
    -- This prevents duplicate logs when the same values are updated
    IF TG_OP = 'UPDATE' THEN
        -- Convert records to JSONB and remove timestamp fields for comparison
        old_record := to_jsonb(OLD) - 'updated_at' - 'created_at';
        new_record := to_jsonb(NEW) - 'updated_at' - 'created_at';

        -- Skip audit log if they are identical (excluding timestamps)
        IF old_record = new_record THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Prepare old_record (with all fields for audit log storage)
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        old_record := to_jsonb(OLD);

        -- For schedules table, add patient and item names to old_record
        IF TG_TABLE_NAME = 'schedules' THEN
            SELECT name INTO patient_name FROM patients WHERE id = OLD.patient_id;
            SELECT name INTO item_name FROM items WHERE id = OLD.item_id;

            IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                old_record := old_record || jsonb_build_object(
                    '_patient_name', patient_name,
                    '_item_name', item_name
                );
            END IF;
        END IF;
    END IF;

    -- Prepare new_record (with all fields for audit log storage)
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        new_record := to_jsonb(NEW);

        -- For schedules table, add patient and item names to new_record
        IF TG_TABLE_NAME = 'schedules' THEN
            SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
            SELECT name INTO item_name FROM items WHERE id = NEW.item_id;

            IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                new_record := new_record || jsonb_build_object(
                    '_patient_name', patient_name,
                    '_item_name', item_name
                );
            END IF;
        END IF;
    END IF;

    -- Log the operation with proper old_values and new_values
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_name,
        user_role
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        old_record,
        new_record,
        auth.uid(),
        user_profile.email,
        user_profile.name,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- Update function comment
-- ============================================================================

COMMENT ON FUNCTION audit_table_changes() IS
    'Universal audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Automatically skips UPDATE operations where no business fields changed (excludes updated_at/created_at).
    Includes patient and item names in schedules table audit logs for better context.';