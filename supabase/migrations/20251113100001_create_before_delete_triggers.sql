-- Migration: Create BEFORE DELETE triggers for user deletion protection and cleanup
-- Date: 2025-11-13
-- Purpose: Implement 2-layer architecture with database-level protection and cleanup

-- ============================================================================
-- 1. Last Admin Protection
-- ============================================================================

-- Function: Check if deleting this user would remove the last admin
CREATE OR REPLACE FUNCTION public.check_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    -- Only check if the user being deleted is an admin
    IF OLD.role = 'admin' THEN
        -- Count remaining admins (excluding the one being deleted)
        SELECT COUNT(*) INTO admin_count
        FROM profiles
        WHERE role = 'admin'
          AND id != OLD.id;

        -- Prevent deletion if this is the last admin
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'Cannot delete the last admin user'
                USING HINT = 'At least one admin must remain in the system',
                      ERRCODE = 'restrict_violation';
        END IF;

        RAISE NOTICE 'Admin deletion allowed: % remaining admin(s) after deletion', admin_count;
    END IF;

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.check_last_admin() IS
'BEFORE DELETE trigger to prevent deletion of the last admin user.
Raises exception if attempting to delete the last admin.';

-- Create trigger
DROP TRIGGER IF EXISTS prevent_last_admin_deletion ON profiles;
CREATE TRIGGER prevent_last_admin_deletion
    BEFORE DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION check_last_admin();

COMMENT ON TRIGGER prevent_last_admin_deletion ON profiles IS
'Prevents deletion of the last admin user to ensure system always has at least one admin.';

-- ============================================================================
-- 2. Audit Log Anonymization
-- ============================================================================

-- Function: Anonymize audit logs before user deletion
CREATE OR REPLACE FUNCTION public.anonymize_user_audit_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Anonymize all audit logs for this user
    UPDATE audit_logs
    SET user_id = NULL,
        user_email = 'deleted-user@system.local',
        user_name = 'Deleted User',
        user_role = 'deleted'
    WHERE user_id = OLD.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RAISE NOTICE 'Anonymized % audit log(s) for user %', affected_rows, OLD.id;

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.anonymize_user_audit_logs() IS
'BEFORE DELETE trigger to anonymize audit logs before user deletion.
Preserves audit trail while removing personal information.';

-- Create trigger
DROP TRIGGER IF EXISTS anonymize_audit_before_delete ON profiles;
CREATE TRIGGER anonymize_audit_before_delete
    BEFORE DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION anonymize_user_audit_logs();

COMMENT ON TRIGGER anonymize_audit_before_delete ON profiles IS
'Anonymizes audit logs before user deletion to preserve audit trail.';

-- ============================================================================
-- 3. Auth Schema Cleanup (Optional - for testing)
-- ============================================================================

-- Function: Clean up auth schema tables before profile deletion
-- NOTE: This function is created but trigger is NOT enabled by default
-- Supabase Auth API should handle auth.users deletion automatically
-- Enable this trigger only if Auth API doesn't clean up properly

CREATE OR REPLACE FUNCTION public.cleanup_auth_schema()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    deleted_sessions INTEGER := 0;
    deleted_identities INTEGER := 0;
    deleted_factors INTEGER := 0;
BEGIN
    -- Clean up auth schema tables
    -- Order matters: children first, then parents

    -- 1. Sessions
    DELETE FROM auth.sessions WHERE user_id = OLD.id;
    GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

    -- 2. MFA factors and challenges
    DELETE FROM auth.mfa_challenges WHERE factor_id IN (
        SELECT id FROM auth.mfa_factors WHERE user_id = OLD.id
    );
    DELETE FROM auth.mfa_factors WHERE user_id = OLD.id;
    GET DIAGNOSTICS deleted_factors = ROW_COUNT;

    -- 3. Identities
    DELETE FROM auth.identities WHERE user_id = OLD.id;
    GET DIAGNOSTICS deleted_identities = ROW_COUNT;

    -- 4. Refresh tokens
    DELETE FROM auth.refresh_tokens WHERE user_id = OLD.id;

    -- 5. One-time tokens (if user_id column exists)
    BEGIN
        DELETE FROM auth.one_time_tokens WHERE user_id = OLD.id;
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE 'auth.one_time_tokens does not have user_id column, skipping';
    END;

    -- 6. Flow state (if user_id column exists)
    BEGIN
        DELETE FROM auth.flow_state WHERE user_id = OLD.id;
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE 'auth.flow_state does not have user_id column, skipping';
    END;

    RAISE NOTICE 'Cleaned up auth schema for user %: % sessions, % identities, % factors',
                 OLD.id, deleted_sessions, deleted_identities, deleted_factors;

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_auth_schema() IS
'BEFORE DELETE trigger to clean up auth schema tables before profile deletion.
NOT enabled by default - Supabase Auth API should handle this automatically.
Enable only if Auth API cleanup is insufficient.';

-- Trigger is commented out by default
-- Uncomment if Supabase Auth API doesn't clean up auth schema properly
-- DROP TRIGGER IF EXISTS cleanup_auth_before_delete ON profiles;
-- CREATE TRIGGER cleanup_auth_before_delete
--     BEFORE DELETE ON profiles
--     FOR EACH ROW
--     EXECUTE FUNCTION cleanup_auth_schema();

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- List all BEFORE DELETE triggers on profiles
DO $$
BEGIN
    RAISE NOTICE 'BEFORE DELETE triggers on profiles table:';
END $$;

SELECT
    tgname AS trigger_name,
    proname AS function_name,
    pg_get_triggerdef(pg_trigger.oid) AS trigger_definition
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE pg_class.relname = 'profiles'
  AND tgname LIKE '%delete%'
ORDER BY tgname;
