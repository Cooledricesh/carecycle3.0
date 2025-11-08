-- ============================================================================
-- Fix Schedules Table Audit Logging - Correct Column Names
-- ============================================================================
-- BUG FIX: The audit trigger was referencing 'scheduled_time' column which
-- doesn't exist in the 'schedules' table. This table has different columns:
-- - last_executed_date
-- - next_due_date
-- - interval_weeks
-- - start_date
-- - end_date
--
-- This fix updates the audit trigger to use the correct column names.
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
        IF user_name IS NULL THEN
            SELECT email INTO user_email
            FROM auth.users
            WHERE id = current_user_id;
        END IF;
    END IF;

    -- Build appropriate old/new records based on table
    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'name', OLD.name,
                    'patient_number', OLD.patient_number,
                    'birth_date', OLD.birth_date,
                    'gender', OLD.gender,
                    'phone', OLD.phone,
                    'address', OLD.address,
                    'email', OLD.email,
                    'status', OLD.status,
                    'admission_date', OLD.admission_date,
                    'discharge_date', OLD.discharge_date,
                    'doctor_id', OLD.doctor_id,
                    'urgency_level', OLD.urgency_level,
                    'notes', OLD.notes,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'name', NEW.name,
                    'patient_number', NEW.patient_number,
                    'birth_date', NEW.birth_date,
                    'gender', NEW.gender,
                    'phone', NEW.phone,
                    'address', NEW.address,
                    'email', NEW.email,
                    'status', NEW.status,
                    'admission_date', NEW.admission_date,
                    'discharge_date', NEW.discharge_date,
                    'doctor_id', NEW.doctor_id,
                    'urgency_level', NEW.urgency_level,
                    'notes', NEW.notes,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'profiles' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'email', OLD.email,
                    'name', OLD.name,
                    'role', OLD.role,
                    'care_type', OLD.care_type,
                    'phone', OLD.phone,
                    'is_active', OLD.is_active,
                    'approval_status', OLD.approval_status,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'email', NEW.email,
                    'name', NEW.name,
                    'role', NEW.role,
                    'care_type', NEW.care_type,
                    'phone', NEW.phone,
                    'is_active', NEW.is_active,
                    'approval_status', NEW.approval_status,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'patient_schedules' THEN
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'patient_name', OLD.patient_name,
                    'scheduled_date', OLD.scheduled_date,
                    'scheduled_time', OLD.scheduled_time,
                    'status', OLD.status,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'patient_name', NEW.patient_name,
                    'scheduled_date', NEW.scheduled_date,
                    'scheduled_time', NEW.scheduled_time,
                    'status', NEW.status,
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
            -- Default handling for other tables
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := to_jsonb(OLD);
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := to_jsonb(NEW);
            END IF;
    END CASE;

    -- For UPDATE, create normalized comparison records
    IF TG_OP = 'UPDATE' THEN
        old_record_for_comparison := safe_old_record - ARRAY['created_at', 'updated_at'];
        new_record_for_comparison := safe_new_record - ARRAY['created_at', 'updated_at'];

        -- Skip if no actual changes (ignoring timestamps)
        IF old_record_for_comparison = new_record_for_comparison THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        user_name,
        user_role,
        table_name,
        record_id,
        operation,
        old_values,
        new_values
    ) VALUES (
        valid_user_id,
        user_email,
        user_name,
        user_role,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        safe_old_record,
        safe_new_record
    );

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

COMMENT ON FUNCTION audit_table_changes() IS
    'Fixed version: Uses correct column names for schedules table (last_executed_date, next_due_date instead of scheduled_time)';
