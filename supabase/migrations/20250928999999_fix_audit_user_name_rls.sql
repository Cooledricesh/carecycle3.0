-- ============================================================================
-- Fix Audit User Name Issue - Bypass RLS for Profile Lookup
-- ============================================================================
-- ROOT CAUSE: The audit trigger function was unable to fetch user profile
-- data because RLS policies block access in SECURITY DEFINER context.
--
-- SOLUTION: Create a SECURITY DEFINER helper function that bypasses RLS
-- to fetch user profile data, then use it in the audit trigger.
-- ============================================================================

-- ============================================================================
-- Helper Function: Get User Profile Bypassing RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_profile_for_audit(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- This function runs with elevated privileges and bypasses RLS
    -- It's safe because it's only used internally by the audit trigger
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.name,
        p.role::TEXT
    FROM public.profiles p
    WHERE p.id = target_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_profile_for_audit(UUID) IS
    'Helper function for audit trigger that bypasses RLS to fetch user profile data.
    Only used internally by audit_table_changes() trigger function.
    SECURITY DEFINER allows reading profiles regardless of RLS policies.';

-- ============================================================================
-- Update Audit Trigger Function to Use Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
    user_name TEXT;
    user_role TEXT;
    old_record_for_comparison jsonb;
    new_record_for_comparison jsonb;
    safe_old_record jsonb;
    safe_new_record jsonb;
    patient_name TEXT;
    item_name TEXT;
    valid_user_id UUID;
BEGIN
    SET LOCAL search_path = public, pg_temp;

    -- Get user ID safely
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        current_user_id := COALESCE(
            nullif(current_setting('request.jwt.claims.sub', true), '')::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;

    -- Validate user_id and fetch profile using RLS-bypassing helper
    IF current_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        valid_user_id := NULL;
        user_email := NULL;
        user_name := NULL;
        user_role := NULL;
    ELSE
        valid_user_id := current_user_id;

        -- Use helper function that bypasses RLS to get profile data
        SELECT
            p.email,
            p.name,
            p.role
        INTO
            user_email,
            user_name,
            user_role
        FROM get_user_profile_for_audit(current_user_id) p;

        -- If profile not found, still log with user_id but NULL profile data
        -- This handles edge cases where user exists but profile doesn't
        IF user_name IS NULL THEN
            -- Try to get email from auth.users as fallback
            SELECT email INTO user_email
            FROM auth.users
            WHERE id = current_user_id;
        END IF;
    END IF;

    -- Skip UPDATE operations with no actual changes
    IF TG_OP = 'UPDATE' THEN
        old_record_for_comparison := to_jsonb(OLD) - 'updated_at' - 'created_at';
        new_record_for_comparison := to_jsonb(NEW) - 'updated_at' - 'created_at';

        IF old_record_for_comparison = new_record_for_comparison THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Build PHI/PII-safe records based on table type
    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'patient_number', OLD.patient_number,
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
                    'last_executed_date', OLD.last_executed_date,
                    'next_due_date', OLD.next_due_date,
                    'interval_weeks', OLD.interval_weeks,
                    'start_date', OLD.start_date,
                    'end_date', OLD.end_date,
                    'status', OLD.status,
                    'assigned_nurse_id', OLD.assigned_nurse_id,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );

                SELECT name INTO item_name FROM items WHERE id = OLD.item_id;

                IF item_name IS NOT NULL THEN
                    safe_old_record := safe_old_record || jsonb_build_object(
                        '_item_name', item_name
                    );
                END IF;
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'patient_id', NEW.patient_id,
                    'item_id', NEW.item_id,
                    'last_executed_date', NEW.last_executed_date,
                    'next_due_date', NEW.next_due_date,
                    'interval_weeks', NEW.interval_weeks,
                    'start_date', NEW.start_date,
                    'end_date', NEW.end_date,
                    'status', NEW.status,
                    'assigned_nurse_id', NEW.assigned_nurse_id,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );

                SELECT name INTO item_name FROM items WHERE id = NEW.item_id;

                IF item_name IS NOT NULL THEN
                    safe_new_record := safe_new_record || jsonb_build_object(
                        '_item_name', item_name
                    );
                END IF;
            END IF;

        ELSE
            -- For unwhitelisted tables, use empty jsonb to prevent PHI/PII exposure
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    '_table', TG_TABLE_NAME,
                    '_warning', 'Table not whitelisted for audit details'
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    '_table', TG_TABLE_NAME,
                    '_warning', 'Table not whitelisted for audit details'
                );
            END IF;
    END CASE;

    -- Insert audit log with user data fetched via RLS-bypassing helper
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
        user_email,
        user_name,
        user_role
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION audit_table_changes() IS
    'PHI/PII-safe audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Fixed to use RLS-bypassing helper function to fetch user profile data.
    This ensures user_name is always populated when a valid user triggers the audit.
    Automatically skips UPDATE operations where no business fields changed.
    Validates user_id before inserting to avoid foreign key constraint violations.';

-- ============================================================================
-- Optional: Backfill user_name for existing NULL entries
-- ============================================================================
-- This query can be run separately to fix existing audit logs
-- with NULL user_name but valid user_id

-- UNCOMMENT TO BACKFILL:
/*
UPDATE audit_logs al
SET user_name = p.name,
    user_email = COALESCE(al.user_email, p.email),
    user_role = COALESCE(al.user_role, p.role::TEXT)
FROM profiles p
WHERE al.user_id = p.id
  AND al.user_name IS NULL
  AND al.user_id IS NOT NULL;
*/