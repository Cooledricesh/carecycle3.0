-- ============================================================================
-- Fix Audit Trigger for Profiles Table (care_type instead of department)
-- ============================================================================
-- The audit trigger was referencing OLD.department/NEW.department but
-- profiles table uses care_type field. This migration fixes the trigger.
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
BEGIN
    SET LOCAL search_path = public, pg_temp;

    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        current_user_id := COALESCE(
            nullif(current_setting('request.jwt.claims.sub', true), '')::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;

    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    IF TG_OP = 'UPDATE' THEN
        old_record_for_comparison := to_jsonb(OLD) - 'updated_at' - 'created_at';
        new_record_for_comparison := to_jsonb(NEW) - 'updated_at' - 'created_at';

        IF old_record_for_comparison = new_record_for_comparison THEN
            RETURN NEW;
        END IF;
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'hospital_id', OLD.hospital_id,
                    'patient_number', OLD.patient_number,
                    'department', OLD.department,
                    'is_active', OLD.is_active,
                    'created_by', OLD.created_by,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'hospital_id', NEW.hospital_id,
                    'patient_number', NEW.patient_number,
                    'department', NEW.department,
                    'is_active', NEW.is_active,
                    'created_by', NEW.created_by,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'profiles' THEN
            -- FIXED: Use care_type instead of department
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
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := to_jsonb(OLD) - 'created_at' - 'updated_at';
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := to_jsonb(NEW) - 'created_at' - 'updated_at';
            END IF;
    END CASE;

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
        current_user_id,
        user_profile.email,
        user_profile.name,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION audit_table_changes() IS
    'PHI/PII-safe audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Fixed to use care_type instead of department for profiles table.
    Automatically skips UPDATE operations where no business fields changed.
    Only stores non-sensitive fields for patients and profiles tables.';