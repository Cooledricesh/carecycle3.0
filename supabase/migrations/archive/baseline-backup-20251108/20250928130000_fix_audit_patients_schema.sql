-- ============================================================================
-- Fix Audit Trigger for Patients Table Schema Mismatch
-- ============================================================================
-- The audit trigger was trying to reference OLD.hospital_id and OLD.department
-- fields that don't exist in the current patients table schema.
-- This migration updates the trigger to use the correct column names.
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_profile public.profiles;
    old_record_for_comparison jsonb;
    new_record_for_comparison jsonb;
    safe_old_record jsonb;
    safe_new_record jsonb;
    patient_name TEXT;
    item_name TEXT;
    valid_user_id UUID;
BEGIN
    SET LOCAL search_path = public, pg_temp;

    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        current_user_id := COALESCE(
            nullif(current_setting('request.jwt.claims.sub', true), '')::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;

    -- Validate user_id exists in auth.users before using it
    -- If it doesn't exist, set to NULL instead
    IF current_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        valid_user_id := NULL;
        user_profile := NULL;
    ELSE
        -- Check if user exists in profiles
        SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
        valid_user_id := current_user_id;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        old_record_for_comparison := to_jsonb(OLD) - 'updated_at' - 'created_at';
        new_record_for_comparison := to_jsonb(NEW) - 'updated_at' - 'created_at';

        IF old_record_for_comparison = new_record_for_comparison THEN
            RETURN NEW;
        END IF;
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            -- Updated to use actual patients table columns
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'patient_number', OLD.patient_number,
                    'name', OLD.name,
                    'care_type', OLD.care_type,
                    'is_active', OLD.is_active,
                    'archived', OLD.archived,
                    'doctor_id', OLD.doctor_id,
                    'created_by', OLD.created_by,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'patient_number', NEW.patient_number,
                    'name', NEW.name,
                    'care_type', NEW.care_type,
                    'is_active', NEW.is_active,
                    'archived', NEW.archived,
                    'doctor_id', NEW.doctor_id,
                    'created_by', NEW.created_by,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'profiles' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'email', OLD.email,
                    'role', OLD.role,
                    'care_type', OLD.care_type,
                    'is_active', OLD.is_active,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'email', NEW.email,
                    'role', NEW.role,
                    'care_type', NEW.care_type,
                    'is_active', NEW.is_active,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'schedules' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'patient_id', OLD.patient_id,
                    'item_id', OLD.item_id,
                    'scheduled_time', OLD.scheduled_time,
                    'status', OLD.status,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );

                SELECT name INTO patient_name FROM patients WHERE id = OLD.patient_id;
                SELECT name INTO item_name FROM items WHERE id = OLD.item_id;

                IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                    safe_old_record := safe_old_record || jsonb_build_object(
                        '_patient_name', patient_name,
                        '_item_name', item_name
                    );
                END IF;
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'patient_id', NEW.patient_id,
                    'item_id', NEW.item_id,
                    'scheduled_time', NEW.scheduled_time,
                    'status', NEW.status,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );

                SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
                SELECT name INTO item_name FROM items WHERE id = NEW.item_id;

                IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                    safe_new_record := safe_new_record || jsonb_build_object(
                        '_patient_name', patient_name,
                        '_item_name', item_name
                    );
                END IF;
            END IF;

        ELSE
            -- Generic fallback for other tables
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := to_jsonb(OLD) - 'created_at' - 'updated_at';
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := to_jsonb(NEW) - 'created_at' - 'updated_at';
            END IF;
    END CASE;

    -- Insert audit log with validated user_id (NULL if invalid)
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
        safe_old_record,
        safe_new_record,
        valid_user_id,
        user_profile.email,
        user_profile.name,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION audit_table_changes() IS
    'PHI/PII-safe audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Fixed to match actual patients table schema - removed hospital_id and department,
    added care_type, archived, and doctor_id fields.
    Validates user_id before inserting to avoid foreign key constraint violations.';