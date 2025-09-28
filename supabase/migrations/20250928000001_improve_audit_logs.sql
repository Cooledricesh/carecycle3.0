-- ============================================================================
-- Improve Audit Logs System (PHI/PII Safe Version)
-- ============================================================================
-- This migration improves the audit logging system by:
-- 1. Adding user_name column to audit_logs table
-- 2. Fixing audit trigger functions to capture old_values on UPDATE
-- 3. Implementing PHI/PII-safe logging (only non-sensitive fields)
-- 4. Adding security measures to prevent schema hijacking
-- 5. Adding audit triggers for patients and schedules tables
-- ============================================================================

-- ============================================================================
-- 1. Add user_name column to audit_logs if it doesn't exist
-- ============================================================================

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS user_name TEXT;

-- ============================================================================
-- 2. Drop existing audit functions and triggers
-- ============================================================================

DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
DROP TRIGGER IF EXISTS audit_patients_trigger ON patients;
DROP TRIGGER IF EXISTS audit_schedules_trigger ON schedules;
DROP TRIGGER IF EXISTS audit_patient_schedules_trigger ON patient_schedules;
DROP FUNCTION IF EXISTS audit_profiles_changes();
DROP FUNCTION IF EXISTS audit_schedules_changes();
DROP FUNCTION IF EXISTS audit_table_changes();

-- ============================================================================
-- 3. Create PHI/PII-safe audit trigger function
-- ============================================================================
-- This function only logs non-sensitive fields to comply with healthcare
-- data privacy requirements. Sensitive fields like patient names, metadata,
-- and phone numbers are excluded from audit logs.
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_profile public.profiles;
    safe_old_record jsonb;
    safe_new_record jsonb;
BEGIN
    -- Set search_path to prevent schema hijacking in SECURITY DEFINER functions
    SET LOCAL search_path = public, pg_temp;

    -- Get user ID safely (handles null auth.uid() gracefully)
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        current_user_id := COALESCE(
            nullif(current_setting('request.jwt.claims.sub', true), '')::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;

    -- Get current user profile using scalar user ID
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- Build PHI/PII-safe records based on table type
    -- Only include non-sensitive fields in audit logs

    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            -- For patients: exclude name, metadata (may contain PHI)
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
            -- For profiles: exclude phone (may be sensitive)
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'email', OLD.email,
                    'role', OLD.role,
                    'department', OLD.department,
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
                    'department', NEW.department,
                    'is_active', NEW.is_active,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        ELSE
            -- For other tables (schedules, patient_schedules, etc.)
            -- Store all fields but exclude timestamps in the stored version
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := to_jsonb(OLD) - 'created_at' - 'updated_at';
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := to_jsonb(NEW) - 'created_at' - 'updated_at';
            END IF;
    END CASE;

    -- Log the operation with PHI/PII-safe values
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

-- ============================================================================
-- 4. Create audit triggers for all relevant tables
-- ============================================================================

CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_patients_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_patient_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patient_schedules
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- ============================================================================
-- 5. Add indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation
    ON audit_logs(table_name, operation);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_name
    ON audit_logs(user_name);

-- ============================================================================
-- 6. Add helpful comment
-- ============================================================================

COMMENT ON FUNCTION audit_table_changes() IS
    'PHI/PII-safe audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Only stores non-sensitive fields for patients and profiles tables.
    Includes security measures: search_path protection, safe auth.uid() handling.
    Complies with healthcare data privacy requirements by excluding PHI/PII from audit logs.';