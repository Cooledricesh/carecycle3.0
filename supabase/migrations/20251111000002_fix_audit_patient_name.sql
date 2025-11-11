-- Migration: Fix audit logs to include patient names
-- Created: 2025-11-11
-- Purpose: Add patient name to audit_logs old_values and new_values for proper display
-- Issue: Admin logs show "환자 환자" instead of actual patient names

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

    -- First, check if user ID was stored in session variable (from SECURITY DEFINER functions)
    current_user_id := nullif(current_setting('app.current_user_id', true), '')::uuid;

    -- If not in session variable, try auth.uid()
    IF current_user_id IS NULL THEN
        current_user_id := auth.uid();
    END IF;

    -- If still NULL, try JWT claims
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
                    'name', OLD.name,
                    'patient_number', OLD.patient_number,
                    'department_id', OLD.department_id,
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
                    'name', NEW.name,
                    'patient_number', NEW.patient_number,
                    'department_id', NEW.department_id,
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
                    'department_id', OLD.department_id,
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
                    'department_id', NEW.department_id,
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

                -- Fetch patient name for schedules
                SELECT name INTO patient_name FROM patients WHERE id = OLD.patient_id;
                IF patient_name IS NOT NULL THEN
                    safe_old_record := safe_old_record || jsonb_build_object(
                        '_patient_name', patient_name
                    );
                END IF;

                -- Fetch item name for schedules
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

                -- Fetch patient name for schedules
                SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
                IF patient_name IS NOT NULL THEN
                    safe_new_record := safe_new_record || jsonb_build_object(
                        '_patient_name', patient_name
                    );
                END IF;

                -- Fetch item name for schedules
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

    -- Insert audit log with user data and organization_id
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_name,
        user_role,
        organization_id
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        safe_old_record,
        safe_new_record,
        valid_user_id,
        user_email,
        user_name,
        user_role,
        COALESCE(NEW.organization_id, OLD.organization_id)
    );

    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Add comment
COMMENT ON FUNCTION audit_table_changes() IS
'Audit trigger function that includes patient names in audit logs for proper display. Records PHI/PII-safe changes to patients, profiles, and schedules tables.';
