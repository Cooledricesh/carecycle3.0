-- ============================================================================
-- Improve Audit Logs System
-- ============================================================================
-- This migration improves the audit logging system by:
-- 1. Fixing audit trigger functions to capture old_values on UPDATE
-- 2. Adding audit triggers for patients and schedules tables
-- 3. Ensuring user information is properly captured
-- ============================================================================

-- ============================================================================
-- 1. Drop existing audit functions and triggers
-- ============================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
DROP TRIGGER IF EXISTS audit_schedules_trigger ON patient_schedules;

-- Drop existing functions
DROP FUNCTION IF EXISTS audit_profiles_changes();
DROP FUNCTION IF EXISTS audit_schedules_changes();

-- ============================================================================
-- 2. Create improved audit trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile public.profiles;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

    -- Log the operation with proper old_values and new_values
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_role
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
            ELSE NULL
        END,
        auth.uid(),
        user_profile.email,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- 3. Create audit triggers for all relevant tables
-- ============================================================================

-- Profiles table
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- Patients table
CREATE TRIGGER audit_patients_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- Schedules table
CREATE TRIGGER audit_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- Patient schedules table (re-create with new function)
CREATE TRIGGER audit_patient_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patient_schedules
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- ============================================================================
-- 4. Add index for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation
    ON audit_logs(table_name, operation);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON audit_logs(user_id);

-- ============================================================================
-- 5. Add helpful comment
-- ============================================================================

COMMENT ON FUNCTION audit_table_changes() IS
    'Universal audit trigger function that logs INSERT, UPDATE, and DELETE operations with full old/new values and user context';