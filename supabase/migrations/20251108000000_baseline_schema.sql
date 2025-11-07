

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Fixed RLS policies to be more permissive for authenticated users to resolve production data loading issues';



CREATE TYPE "public"."appointment_type" AS ENUM (
    'consultation',
    'treatment',
    'follow_up',
    'emergency',
    'routine_check'
);


ALTER TYPE "public"."appointment_type" OWNER TO "postgres";


CREATE TYPE "public"."approval_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."approval_status" OWNER TO "postgres";


CREATE TYPE "public"."execution_status" AS ENUM (
    'planned',
    'completed',
    'skipped',
    'overdue'
);


ALTER TYPE "public"."execution_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'dashboard',
    'push',
    'email'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_state" AS ENUM (
    'pending',
    'ready',
    'sent',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."notification_state" OWNER TO "postgres";


COMMENT ON TYPE "public"."notification_state" IS 'Notification states: pending (대기중), ready (준비됨), sent (발송됨), failed (실패), cancelled (취소됨)';



CREATE TYPE "public"."schedule_status" AS ENUM (
    'active',
    'paused',
    'completed',
    'deleted',
    'cancelled'
);


ALTER TYPE "public"."schedule_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'nurse',
    'admin',
    'doctor'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target_role text;
  v_admin_count integer;
  v_deleted_rows json;
BEGIN
  -- Check if target user exists and get their role
  SELECT role INTO v_target_role
  FROM profiles
  WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent deleting the last admin
  IF v_target_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM profiles
    WHERE role = 'admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin';
    END IF;
  END IF;

  -- Begin transaction (implicit in function)

  -- 1. Anonymize audit logs instead of deleting (compliance requirement)
  UPDATE audit_logs
  SET
    user_id = NULL,
    user_email = 'deleted-user@system.local',
    user_display_name = 'Deleted User'
  WHERE user_id = p_user_id;

  -- 2. Delete notification records (not audit-critical)
  DELETE FROM notifications WHERE recipient_id = p_user_id;

  -- 3. Delete schedule logs (not audit-critical)
  DELETE FROM schedule_logs WHERE changed_by = p_user_id;

  -- 4. Delete user preferences
  DELETE FROM user_preferences WHERE user_id = p_user_id;

  -- 5. Delete query performance logs
  DELETE FROM query_performance_log WHERE user_id = p_user_id;

  -- 6. Nullify foreign key references in schedules and related tables
  UPDATE schedule_executions
  SET executed_by = NULL
  WHERE executed_by = p_user_id;

  UPDATE schedule_executions
  SET doctor_id_at_completion = NULL
  WHERE doctor_id_at_completion = p_user_id;

  UPDATE schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE schedules
  SET assigned_nurse_id = NULL
  WHERE assigned_nurse_id = p_user_id;

  UPDATE patients
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE patients
  SET doctor_id = NULL
  WHERE doctor_id = p_user_id;

  UPDATE patient_schedules
  SET nurse_id = NULL
  WHERE nurse_id = p_user_id;

  UPDATE patient_schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE profiles
  SET approved_by = NULL
  WHERE approved_by = p_user_id;

  -- Return summary of operation
  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User data cleaned up successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to delete user data: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") IS 'Atomically deletes user data with audit trail preservation. Prevents deletion of last admin. Must be called by service role.';



CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target_role text;
BEGIN
  -- Try to get role from profiles (may be NULL if already CASCADE deleted)
  SELECT role INTO v_target_role
  FROM profiles
  WHERE id = p_user_id;

  -- If profile already deleted, use the passed parameter
  IF v_target_role IS NULL THEN
    v_target_role := p_target_role;
  END IF;

  -- Prevent deleting the last admin using pre-calculated count
  IF v_target_role = 'admin' THEN
    IF p_remaining_admins <= 0 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin';
    END IF;
  END IF;

  -- Begin transaction (implicit in function)

  -- 1. Anonymize audit logs instead of deleting (compliance requirement)
  UPDATE audit_logs
  SET
    user_id = NULL,
    user_email = 'deleted-user@system.local',
    user_name = 'Deleted User'
  WHERE user_id = p_user_id;

  -- 2. Delete notification records (not audit-critical)
  DELETE FROM notifications WHERE recipient_id = p_user_id;

  -- 3. Delete schedule logs (not audit-critical)
  DELETE FROM schedule_logs WHERE changed_by = p_user_id;

  -- 4. Delete user preferences
  DELETE FROM user_preferences WHERE user_id = p_user_id;

  -- 5. Delete query performance logs
  DELETE FROM query_performance_log WHERE user_id = p_user_id;

  -- 6. Nullify foreign key references in schedules and related tables
  UPDATE schedule_executions
  SET executed_by = NULL
  WHERE executed_by = p_user_id;

  UPDATE schedule_executions
  SET doctor_id_at_completion = NULL
  WHERE doctor_id_at_completion = p_user_id;

  UPDATE schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE schedules
  SET assigned_nurse_id = NULL
  WHERE assigned_nurse_id = p_user_id;

  UPDATE patients
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE patients
  SET doctor_id = NULL
  WHERE doctor_id = p_user_id;

  UPDATE patient_schedules
  SET nurse_id = NULL
  WHERE nurse_id = p_user_id;

  UPDATE patient_schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE profiles
  SET approved_by = NULL
  WHERE approved_by = p_user_id;

  -- Return summary of operation
  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User data cleaned up successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to delete user data: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) IS 'Atomically deletes user data with audit trail preservation. Prevents deletion of last admin. Must be called by service role. Accepts pre-calculated role and admin count to handle CASCADE deletion.';



CREATE OR REPLACE FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_organization_id UUID;
    v_admin_org_id UUID;
    v_user_email TEXT;
    v_user_name TEXT;
    v_requested_role TEXT;
    v_final_role TEXT;
    v_user_id UUID;
BEGIN
    -- Verify admin permissions
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.';
    END IF;

    -- Get join request details
    SELECT organization_id, email, name, role
    INTO v_organization_id, v_user_email, v_user_name, v_requested_role
    FROM public.join_requests
    WHERE id = p_join_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '대기 중인 가입 신청을 찾을 수 없습니다.';
    END IF;

    -- SECURITY FIX: Get admin's organization
    SELECT organization_id INTO v_admin_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- SECURITY FIX: Verify admin's org matches request's org
    IF v_admin_org_id IS DISTINCT FROM v_organization_id THEN
        RAISE EXCEPTION 'Cannot process join requests for other organizations';
    END IF;

    -- Determine final role (admin can override)
    v_final_role := COALESCE(p_assigned_role, v_requested_role);

    -- Validate role
    IF v_final_role NOT IN ('admin', 'doctor', 'nurse') THEN
        RAISE EXCEPTION '유효하지 않은 역할입니다: %', v_final_role;
    END IF;

    -- Find user by email (they should have already signed up)
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE email = v_user_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '해당 이메일로 가입한 사용자를 찾을 수 없습니다: %', v_user_email;
    END IF;

    -- Update user profile
    UPDATE public.profiles
    SET
        organization_id = v_organization_id,
        role = v_final_role::user_role,
        approval_status = 'approved'::approval_status,
        is_active = true,
        approved_by = p_admin_id,
        approved_at = NOW()
    WHERE id = v_user_id;

    -- Update join request
    UPDATE public.join_requests
    SET
        status = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_join_request_id;

    RAISE NOTICE '가입 신청 승인 완료: % (%)', v_user_name, v_user_email;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '가입 신청 승인 실패: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text") IS '가입 신청 승인 (관리자만, 동일 조직 내)';



CREATE OR REPLACE FUNCTION "public"."approve_user"("user_id" "uuid", "approved_by_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can approve users';
    END IF;
    
    UPDATE public.profiles 
    SET approval_status = 'approved', is_active = true, approved_by = approved_by_id, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."approve_user"("user_id" "uuid", "approved_by_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    current_number text;
    timestamp_suffix text;
    new_archived_number text;
BEGIN
    -- Get current patient number
    SELECT patient_number INTO current_number 
    FROM patients 
    WHERE id = patient_id;
    
    -- Generate timestamp suffix
    timestamp_suffix := to_char(now(), 'YYYYMMDDHH24MISS');
    new_archived_number := current_number || '_archived_' || timestamp_suffix;
    
    -- Update patient record
    UPDATE patients 
    SET 
        archived = true,
        archived_at = now(),
        is_active = false,
        original_patient_number = current_number,
        patient_number = new_archived_number,
        updated_at = now()
    WHERE id = patient_id;
END;
$$;


ALTER FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") IS 'Archives a patient by setting archived=true and appending timestamp to patient_number';



CREATE OR REPLACE FUNCTION "public"."audit_table_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."audit_table_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."audit_table_changes"() IS 'Audit trigger function that checks session variable first for user context.
    This handles SECURITY DEFINER functions that store user ID in app.current_user_id.
    Falls back to auth.uid() for normal operations.';



CREATE OR REPLACE FUNCTION "public"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_data json;
  v_new_data json;
  v_user_id uuid;
  v_user_email text;
  v_user_role text;
  v_user_name text;  -- Add user name variable
BEGIN
  -- Get user information from auth context
  v_user_id := auth.uid();
  v_user_email := current_setting('request.jwt.claims', true)::json->>'email';
  v_user_role := current_setting('request.jwt.claims', true)::json->>'user_metadata'->>'role';

  -- Get user name from profiles table if user is authenticated
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name
    FROM profiles
    WHERE id = v_user_id
    LIMIT 1;
  END IF;

  -- Handle different operations
  IF TG_OP = 'UPDATE' THEN
    v_old_data := to_json(OLD);
    v_new_data := to_json(NEW);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      NEW.id,
      v_old_data,
      v_new_data,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_json(OLD);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      OLD.id,
      v_old_data,
      NULL,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );

  ELSIF TG_OP = 'INSERT' THEN
    v_new_data := to_json(NEW);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      NEW.id,
      NULL,
      v_new_data,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_doctor_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only process doctor role profiles
  IF NEW.role = 'doctor' AND NEW.name IS NOT NULL THEN
    -- Update patients where assigned_doctor_name matches the new doctor's name
    -- Only update if they don't already have a registered doctor
    UPDATE patients
    SET
      doctor_id = NEW.id,
      assigned_doctor_name = NULL,  -- Clear the text assignment
      updated_at = now()
    WHERE
      assigned_doctor_name = NEW.name
      AND doctor_id IS NULL;

    -- Log the auto-linking for audit
    IF FOUND THEN
      RAISE NOTICE 'Auto-linked % patients to doctor % (%)',
        ROW_COUNT, NEW.name, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_link_doctor_on_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text" DEFAULT '일괄 아카이브'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    patient_id uuid;
    processed_count integer := 0;
    current_number text;
    timestamp_suffix text;
    new_archived_number text;
    result jsonb;
BEGIN
    -- Generate timestamp suffix once for the entire batch
    timestamp_suffix := to_char(now(), 'YYYYMMDDHH24MISS');
    
    -- Process each patient in the transaction
    FOREACH patient_id IN ARRAY patient_ids
    LOOP
        -- Get current patient number and verify it's eligible for archiving
        SELECT patient_number INTO current_number 
        FROM patients 
        WHERE id = patient_id 
        AND is_active = false 
        AND archived = false;
        
        -- Skip if patient not found or not eligible
        IF current_number IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Generate unique archived number
        new_archived_number := current_number || '_archived_' || timestamp_suffix || '_' || processed_count;
        
        -- Archive the patient
        UPDATE patients 
        SET 
            archived = true,
            archived_at = now(),
            is_active = false,
            original_patient_number = current_number,
            patient_number = new_archived_number,
            updated_at = now()
        WHERE id = patient_id;
        
        -- Increment processed count
        processed_count := processed_count + 1;
        
        -- Log the archiving (optional: could insert into an archive log table)
        RAISE NOTICE 'Archived patient % with reason: %', current_number, archive_reason;
    END LOOP;
    
    -- Return result summary
    result := jsonb_build_object(
        'processed_count', processed_count,
        'timestamp', now(),
        'reason', archive_reason
    );
    
    RETURN result;
EXCEPTION
    WHEN others THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Bulk archive failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text") IS 'Archives multiple patients in a single transaction with custom reason';



CREATE OR REPLACE FUNCTION "public"."calculate_next_due_date"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_schedule RECORD;
BEGIN
    -- Only process when execution is completed
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- Get the schedule details including organization_id
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;

        -- Skip if schedule is not active
        IF v_schedule.status != 'active' THEN
            RAISE NOTICE 'Skipping next_due_date calculation for non-active schedule %', NEW.schedule_id;
            RETURN NEW;
        END IF;

        -- Calculate next due date based on EXECUTED date
        UPDATE schedules
        SET
            next_due_date = NEW.executed_date + (COALESCE(interval_weeks, 0) * 7 || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;

        -- Create notification for long-interval schedules
        IF v_schedule.interval_weeks >= 4 AND v_schedule.requires_notification THEN
            -- Validate organization_id exists
            IF v_schedule.organization_id IS NULL THEN
                RAISE WARNING 'Schedule % has no organization_id, skipping notification creation', NEW.schedule_id;
            ELSE
                INSERT INTO notifications (
                    schedule_id,
                    recipient_id,
                    channel,
                    notify_date,
                    title,
                    message,
                    organization_id  -- NEW: Include organization_id
                ) VALUES (
                    NEW.schedule_id,
                    COALESCE(v_schedule.assigned_nurse_id, v_schedule.created_by),
                    'dashboard'::notification_channel,
                    (NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval -
                     (v_schedule.notification_days_before || ' days')::interval)::date,
                    '일정 알림',
                    format('예정된 일정이 %s일 후 도래합니다.', v_schedule.notification_days_before),
                    v_schedule.organization_id  -- NEW: Use organization_id from schedule
                ) ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_next_due_date"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_next_due_date"() IS 'Calculates next due date with input validation for interval_weeks to prevent generate_series errors.
Validates interval_weeks is not NULL and greater than 0 before using in calculations.';



CREATE OR REPLACE FUNCTION "public"."calculate_next_due_date"("p_interval_days" integer, "p_reference_date" "date") RETURNS "date"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Simple day-based interval calculation
    RETURN p_reference_date + (p_interval_days || ' days')::interval;
END;
$$;


ALTER FUNCTION "public"."calculate_next_due_date"("p_interval_days" integer, "p_reference_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_assignment_at_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only capture on completion
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get current doctor_id and care_type from patient
    SELECT p.doctor_id, p.care_type
    INTO NEW.doctor_id_at_completion, NEW.care_type_at_completion
    FROM patients p
    JOIN schedules s ON s.patient_id = p.id
    WHERE s.id = NEW.schedule_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_assignment_at_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_patient_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    affected_schedules INTEGER := 0;
    affected_patient_schedules INTEGER := 0;
    patient_name_var TEXT;
BEGIN
    -- Validate inputs
    IF NEW.id IS NULL THEN
        RAISE WARNING 'Attempted to process null patient ID';
        RETURN NEW;
    END IF;
    
    -- Get patient name for patient_schedules table
    SELECT name INTO patient_name_var FROM patients WHERE id = NEW.id;
    
    -- Check if patient is being soft deleted (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        BEGIN
            -- Handle schedules table (soft delete)
            UPDATE schedules 
            SET 
                status = 'deleted',
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                patient_id = NEW.id 
                AND status IN ('active', 'paused');
            
            GET DIAGNOSTICS affected_schedules = ROW_COUNT;
            
            -- Handle patient_schedules table (hard delete by patient_name)
            DELETE FROM patient_schedules
            WHERE patient_name = patient_name_var;
            
            GET DIAGNOSTICS affected_patient_schedules = ROW_COUNT;
            
            -- Log the cascade action with timestamp
            RAISE NOTICE '[%] Cascaded deletion: Deleted % patient_schedules and soft-deleted % schedules for patient % (%)', 
                CURRENT_TIMESTAMP, affected_patient_schedules, affected_schedules, NEW.id, patient_name_var;
                
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                RAISE WARNING 'Failed to cascade delete schedules for patient %: %', 
                    NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_patient_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS(
        SELECT 1 
        FROM profiles 
        WHERE id = user_id 
        AND role = 'admin'
        LIMIT 1
    );
$$;


ALTER FUNCTION "public"."check_is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_role_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only check if role is being changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Prevent users from changing their own role
        -- But allow if triggered by service role (admin operations)
        IF OLD.id = auth.uid() AND current_setting('role', true) != 'service_role' THEN
            RAISE EXCEPTION 'Users cannot change their own role';
        END IF;
    END IF;
    
    -- Allow the update
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_role_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_schedule_conflict"("p_nurse_id" "uuid", "p_scheduled_date" "date", "p_scheduled_time" time without time zone, "p_duration_minutes" integer, "p_exclude_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    conflict_count INTEGER;
    end_time TIME;
BEGIN
    end_time := p_scheduled_time + (p_duration_minutes || ' minutes')::INTERVAL;
    
    SELECT COUNT(*)
    INTO conflict_count
    FROM public.patient_schedules
    WHERE nurse_id = p_nurse_id
    AND scheduled_date = p_scheduled_date
    AND status NOT IN ('cancelled', 'no_show')
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
    AND (
        -- New appointment starts during existing appointment
        (p_scheduled_time >= scheduled_time AND p_scheduled_time < scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- New appointment ends during existing appointment
        (end_time > scheduled_time AND end_time <= scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- New appointment encompasses existing appointment
        (p_scheduled_time <= scheduled_time AND end_time >= scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
    );
    
    RETURN conflict_count > 0;
END;
$$;


ALTER FUNCTION "public"."check_schedule_conflict"("p_nurse_id" "uuid", "p_scheduled_date" "date", "p_scheduled_time" time without time zone, "p_duration_minutes" integer, "p_exclude_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_execution_id UUID;
    v_organization_id UUID;
    v_calling_user_id UUID;
BEGIN
    -- Capture the calling user's ID BEFORE losing auth context
    v_calling_user_id := auth.uid();

    -- Store it in a session variable that the audit trigger can access
    PERFORM set_config('app.current_user_id', v_calling_user_id::text, true);

    -- Get organization_id from the schedule
    SELECT organization_id INTO v_organization_id
    FROM schedules
    WHERE id = p_schedule_id
    LIMIT 1;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Could not find organization_id for schedule %', p_schedule_id;
    END IF;

    -- Try to find existing execution record
    SELECT id INTO v_execution_id
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id
    AND planned_date = p_planned_date;

    IF v_execution_id IS NOT NULL THEN
        -- Update existing record
        UPDATE schedule_executions
        SET
            executed_date = p_executed_date,
            executed_time = CURRENT_TIME,
            status = 'completed'::execution_status,
            executed_by = p_executed_by,
            notes = COALESCE(p_notes, notes),
            updated_at = NOW()
        WHERE id = v_execution_id;

        RAISE NOTICE 'Updated existing execution record %', v_execution_id;
    ELSE
        -- Insert new record with organization_id
        INSERT INTO schedule_executions (
            schedule_id,
            planned_date,
            executed_date,
            executed_time,
            status,
            executed_by,
            notes,
            organization_id,
            created_at,
            updated_at
        ) VALUES (
            p_schedule_id,
            p_planned_date,
            p_executed_date,
            CURRENT_TIME,
            'completed'::execution_status,
            p_executed_by,
            p_notes,
            v_organization_id,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Created new execution record with organization_id %', v_organization_id;
    END IF;

    -- The trigger will automatically handle next_due_date calculation
    -- and will use the session variable for audit logging
END;
$$;


ALTER FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text") IS 'Completes a schedule execution and preserves user context for audit logging.
    The calling user ID is stored in a session variable before entering SECURITY DEFINER context.';



CREATE OR REPLACE FUNCTION "public"."create_bulk_schedules"("p_patient_ids" "uuid"[], "p_item_id" "uuid", "p_interval_days" integer, "p_start_date" "date", "p_assigned_nurse_id" "uuid" DEFAULT NULL::"uuid", "p_requires_notification" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count integer := 0;
    v_patient_id uuid;
BEGIN
    -- Set notification requirement based on interval
    IF p_interval_days >= 28 THEN
        p_requires_notification := true;
    END IF;
    
    FOREACH v_patient_id IN ARRAY p_patient_ids
    LOOP
        INSERT INTO schedules (
            patient_id,
            item_id,
            interval_days,
            start_date,
            next_due_date,
            assigned_nurse_id,
            requires_notification,
            created_by
        )
        VALUES (
            v_patient_id,
            p_item_id,
            p_interval_days,
            p_start_date,
            p_start_date,
            p_assigned_nurse_id,
            p_requires_notification,
            auth.uid()
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."create_bulk_schedules"("p_patient_ids" "uuid"[], "p_item_id" "uuid", "p_interval_days" integer, "p_start_date" "date", "p_assigned_nurse_id" "uuid", "p_requires_notification" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text" DEFAULT 'admin'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- SECURITY FIX: Validate that p_user_id matches authenticated user
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Can only modify your own profile';
    END IF;

    -- Validate organization name
    IF p_organization_name IS NULL OR TRIM(p_organization_name) = '' THEN
        RAISE EXCEPTION '조직명은 필수입니다.';
    END IF;

    -- Validate user role
    IF p_user_role NOT IN ('admin', 'doctor', 'nurse') THEN
        RAISE EXCEPTION '유효하지 않은 역할입니다: %', p_user_role;
    END IF;

    -- 1. 새 조직 생성
    INSERT INTO public.organizations (name)
    VALUES (p_organization_name)
    RETURNING id INTO new_org_id;

    -- 2. 사용자 프로필 업데이트 (organization 할당 및 승인)
    UPDATE public.profiles
    SET
        organization_id = new_org_id,
        role = p_user_role::user_role,
        approval_status = 'approved'::approval_status,
        is_active = true,
        approved_at = NOW(),
        approved_by = p_user_id  -- Self-approval for first admin
    WHERE id = p_user_id;

    -- Verify update
    IF NOT FOUND THEN
        RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', p_user_id;
    END IF;

    RAISE NOTICE '새 조직 생성 완료: % (ID: %), 첫 관리자: %', p_organization_name, new_org_id, p_user_name;

    RETURN new_org_id;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '이미 존재하는 조직명입니다: %', p_organization_name;
    WHEN OTHERS THEN
        RAISE EXCEPTION '조직 생성 또는 사용자 등록 실패: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text") IS '새 조직 생성 및 사용자를 첫 관리자로 등록 (자신의 프로필만)';



CREATE OR REPLACE FUNCTION "public"."create_schedule_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 알림이 필요한 활성 일정에 대해서만 알림 생성
    IF NEW.status = 'active' AND NEW.requires_notification = true THEN
        -- 기존 대기중 알림 삭제
        DELETE FROM notifications 
        WHERE schedule_id = NEW.id 
        AND state = 'pending';
        
        -- 새 알림 생성 (예정일 N일 전, 4주 이상 간격만)
        IF NEW.interval_weeks >= 4 AND 
           NEW.next_due_date - CURRENT_DATE <= NEW.notification_days_before THEN
            -- Validate organization_id exists
            IF NEW.organization_id IS NULL THEN
                RAISE WARNING 'Schedule % has no organization_id, skipping notification creation', NEW.id;
            ELSE
                INSERT INTO notifications (
                    schedule_id,
                    recipient_id,
                    channel,
                    notify_date,
                    title,
                    message,
                    organization_id  -- NEW: Include organization_id
                )
                VALUES (
                    NEW.id,
                    COALESCE(NEW.assigned_nurse_id, NEW.created_by),
                    'dashboard',
                    GREATEST(CURRENT_DATE, NEW.next_due_date - NEW.notification_days_before),
                    '일정 알림',
                    format('환자 일정이 %s에 예정되어 있습니다. (간격: %s주)', 
                           NEW.next_due_date, NEW.interval_weeks),
                    NEW.organization_id  -- NEW: Use organization_id from schedule
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_schedule_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_user"("user_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can deactivate users';
    END IF;
    
    IF user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot deactivate yourself';
    END IF;
    
    UPDATE public.profiles 
    SET is_active = false, rejection_reason = COALESCE(reason, 'Deactivated by admin'), updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."deactivate_user"("user_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_patient_data"("encrypted_data" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_decrypt(encrypted_data, get_encryption_key());
END;
$$;


ALTER FUNCTION "public"."decrypt_patient_data"("encrypted_data" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
END;
$$;


ALTER FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") IS 'SECURITY DEFINER function for decrypting text data. Uses SET search_path = public for security.';



CREATE OR REPLACE FUNCTION "public"."encrypt_patient_data"("plain_text" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(plain_text, get_encryption_key());
END;
$$;


ALTER FUNCTION "public"."encrypt_patient_data"("plain_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_text"("plain_text" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(plain_text, current_setting('app.encryption_key'));
END;
$$;


ALTER FUNCTION "public"."encrypt_text"("plain_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."encrypt_text"("plain_text" "text") IS 'SECURITY DEFINER function for encrypting text data. Uses SET search_path = public for security.';



CREATE OR REPLACE FUNCTION "public"."generate_recurring_events"("p_schedule_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_schedule RECORD;
  v_current_date DATE;
  v_count INTEGER := 0;
  v_result JSONB;
  v_interval_days INTEGER;
  v_total_events INTEGER;
  v_event_dates DATE[];
BEGIN
  -- Get schedule details
  SELECT
    id,
    patient_id,
    interval_unit,
    interval_value,
    assigned_nurse_id,
    duration_minutes,
    notes
  INTO v_schedule
  FROM public.schedules
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Input validation
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  -- Calculate interval in days
  v_interval_days := CASE v_schedule.interval_unit
    WHEN 'day' THEN v_schedule.interval_value
    WHEN 'week' THEN v_schedule.interval_value * 7
    WHEN 'month' THEN v_schedule.interval_value * 30  -- Approximation
    ELSE 7  -- Default to weekly
  END;

  -- Pre-calculate total events to limit
  v_total_events := CEIL((p_end_date - p_start_date + 1)::NUMERIC / v_interval_days);

  -- Limit total events to prevent excessive generation
  IF v_total_events > 365 THEN
    RAISE EXCEPTION 'Too many events to generate (%). Maximum allowed is 365', v_total_events;
  END IF;

  -- Generate events
  v_current_date := p_start_date;

  -- Collect all event dates first for batch insert
  WHILE v_current_date <= p_end_date LOOP
    v_event_dates := array_append(v_event_dates, v_current_date);
    v_count := v_count + 1;

    -- Calculate next date based on interval
    v_current_date := CASE v_schedule.interval_unit
      WHEN 'day' THEN v_current_date + (v_schedule.interval_value || ' days')::INTERVAL
      WHEN 'week' THEN v_current_date + (v_schedule.interval_value || ' weeks')::INTERVAL
      WHEN 'month' THEN v_current_date + (v_schedule.interval_value || ' months')::INTERVAL
      ELSE v_current_date + INTERVAL '1 week'
    END;
  END LOOP;

  -- Batch insert all events
  IF v_count > 0 THEN
    INSERT INTO public.patient_schedules (
      patient_id,
      nurse_id,
      scheduled_date,
      scheduled_time,
      status,
      test_type,
      duration_minutes,
      notes,
      created_by
    )
    SELECT
      v_schedule.patient_id,
      v_schedule.assigned_nurse_id,
      event_date,
      '09:00:00'::TIME,  -- Default time
      'scheduled',
      'recurring_event',
      v_schedule.duration_minutes,
      v_schedule.notes,
      auth.uid()
    FROM unnest(v_event_dates) AS event_date;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'events_created', v_count,
    'schedule_id', p_schedule_id,
    'start_date', p_start_date::text,
    'end_date', p_end_date::text
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."generate_recurring_events"("p_schedule_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("schedule_id" "uuid", "patient_id" "uuid", "item_id" "uuid", "display_date" "date", "display_type" "text", "schedule_status" "text", "execution_id" "uuid", "executed_by" "uuid", "execution_notes" "text", "patient_name" "text", "patient_number" "text", "care_type" "text", "doctor_id" "uuid", "doctor_name" "text", "item_name" "text", "item_category" "text", "interval_weeks" integer, "priority" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    -- Future/current schedules from schedules table
    SELECT
        s.id as schedule_id,
        s.patient_id,
        s.item_id,
        s.next_due_date as display_date,
        'scheduled'::TEXT as display_type,
        s.status::TEXT as schedule_status,
        NULL::UUID as execution_id,
        s.assigned_nurse_id as executed_by,
        s.notes as execution_notes,
        p.name as patient_name,
        p.patient_number,
        p.care_type,
        p.doctor_id,
        pr.name as doctor_name,
        i.name as item_name,
        i.category as item_category,
        s.interval_weeks,
        s.priority
    FROM schedules s
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    LEFT JOIN profiles pr ON p.doctor_id = pr.id
    WHERE s.next_due_date BETWEEN p_start_date AND p_end_date
    AND s.status IN ('active', 'paused')
    AND (p_user_id IS NULL OR
         EXISTS (
            SELECT 1 FROM profiles prf
            WHERE prf.id = p_user_id
            AND prf.is_active = true
            AND prf.approval_status = 'approved'
         ))

    UNION ALL

    -- Historical completed executions
    SELECT
        se.schedule_id,
        s.patient_id,
        s.item_id,
        se.executed_date as display_date,
        'completed'::TEXT as display_type,
        'completed'::TEXT as schedule_status,
        se.id as execution_id,
        se.executed_by,
        se.notes as execution_notes,
        p.name as patient_name,
        p.patient_number,
        p.care_type,
        p.doctor_id,
        pr.name as doctor_name,
        i.name as item_name,
        i.category as item_category,
        s.interval_weeks,
        s.priority
    FROM schedule_executions se
    JOIN schedules s ON se.schedule_id = s.id
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    LEFT JOIN profiles pr ON p.doctor_id = pr.id
    WHERE se.executed_date BETWEEN p_start_date AND p_end_date
    AND se.status = 'completed'
    AND (p_user_id IS NULL OR
         EXISTS (
            SELECT 1 FROM profiles prf
            WHERE prf.id = p_user_id
            AND prf.is_active = true
            AND prf.approval_status = 'approved'
         ))

    ORDER BY display_date, priority DESC;
END;
$$;


ALTER FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid") IS 'Retrieves both scheduled and completed schedule records for calendar display with filter fields (care_type, doctor_id, patient_number, doctor_name)';



CREATE OR REPLACE FUNCTION "public"."get_calendar_schedules_filtered"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid", "p_show_all" boolean DEFAULT false, "p_care_types" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("schedule_id" "uuid", "patient_id" "uuid", "item_id" "uuid", "display_date" "date", "display_type" "text", "schedule_status" "text", "execution_id" "uuid", "executed_by" "uuid", "execution_notes" "text", "patient_name" "text", "item_name" "text", "item_category" "text", "interval_weeks" integer, "priority" integer, "doctor_id" "uuid", "care_type" "text", "doctor_id_at_completion" "uuid", "care_type_at_completion" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_role TEXT;
  v_user_care_type TEXT;
BEGIN
  -- Get user role and care_type (fix: use explicit table prefix)
  SELECT pr.role, pr.care_type INTO v_user_role, v_user_care_type
  FROM profiles pr
  WHERE pr.id = p_user_id;

  RETURN QUERY
  -- Future/current schedules from schedules table
  SELECT
    s.id as schedule_id,
    s.patient_id,
    s.item_id,
    s.next_due_date as display_date,
    'scheduled'::TEXT as display_type,
    s.status::TEXT as schedule_status,
    NULL::UUID as execution_id,
    s.assigned_nurse_id as executed_by,
    s.notes as execution_notes,
    p.name as patient_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.priority,
    p.doctor_id as doctor_id,
    p.care_type as care_type,
    NULL::UUID as doctor_id_at_completion,
    NULL::TEXT as care_type_at_completion
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  JOIN items i ON s.item_id = i.id
  WHERE s.next_due_date BETWEEN p_start_date AND p_end_date
  AND s.status IN ('active', 'paused')
  -- Role-based filtering for future schedules (use current assignments)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type)
  )
  -- Care type filter
  AND (p_care_types IS NULL OR p.care_type = ANY(p_care_types))

  UNION ALL

  -- Historical completed executions
  SELECT
    se.schedule_id,
    s.patient_id,
    s.item_id,
    se.executed_date as display_date,
    'completed'::TEXT as display_type,
    'completed'::TEXT as schedule_status,
    se.id as execution_id,
    se.executed_by,
    se.notes as execution_notes,
    p.name as patient_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.priority,
    p.doctor_id as doctor_id,
    p.care_type as care_type,
    se.doctor_id_at_completion,
    se.care_type_at_completion
  FROM schedule_executions se
  JOIN schedules s ON se.schedule_id = s.id
  JOIN patients p ON s.patient_id = p.id
  JOIN items i ON s.item_id = i.id
  WHERE se.executed_date BETWEEN p_start_date AND p_end_date
  AND se.status = 'completed'
  -- Role-based filtering for completed schedules
  -- Use historical assignments if available, otherwise fall back to current
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND (
      COALESCE(se.doctor_id_at_completion, p.doctor_id) = p_user_id
    ))
    OR (v_user_role = 'nurse' AND (
      COALESCE(se.care_type_at_completion, p.care_type) = v_user_care_type
    ))
  )
  -- Care type filter (check both historical and current)
  AND (p_care_types IS NULL OR
       COALESCE(se.care_type_at_completion, p.care_type) = ANY(p_care_types))

  ORDER BY display_date, priority DESC;
END;
$$;


ALTER FUNCTION "public"."get_calendar_schedules_filtered"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_org_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id
    INTO org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN org_id;
END;
$$;


ALTER FUNCTION "public"."get_current_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_organization_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Get the organization_id for the current user
    -- Using SECURITY DEFINER means this query bypasses RLS policies
    SELECT organization_id INTO org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    RETURN org_id;
END;
$$;


ALTER FUNCTION "public"."get_current_user_organization_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_user_organization_id"() IS '현재 사용자의 organization_id를 반환합니다 (RLS 정책용)';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'nurse'::"public"."user_role" NOT NULL,
    "care_type" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approval_status" "public"."approval_status" DEFAULT 'pending'::"public"."approval_status",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "check_role_care_type" CHECK (((("role" = 'nurse'::"public"."user_role") AND ("care_type" = ANY (ARRAY['외래'::"text", '입원'::"text", '낮병원'::"text"]))) OR (("role" = ANY (ARRAY['admin'::"public"."user_role", 'doctor'::"public"."user_role"])) AND ("care_type" IS NULL))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."care_type" IS 'Care type assignment for nurses (외래/입원/낮병원), NULL for admin/doctor roles';



COMMENT ON COLUMN "public"."profiles"."organization_id" IS '사용자가 소속된 조직 ID';



CREATE OR REPLACE FUNCTION "public"."get_current_user_profile"() RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT p.* FROM public.profiles p
        WHERE p.id = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."get_current_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_db_stats"() RETURNS TABLE("metric" "text", "value" bigint, "description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
    
    RETURN QUERY
    SELECT 
        'connection_count'::TEXT,
        COUNT(*)::BIGINT,
        'Current active connections'::TEXT
    FROM pg_stat_activity
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'database_size'::TEXT,
        pg_database_size(current_database())::BIGINT,
        'Database size in bytes'::TEXT
    
    UNION ALL
    
    SELECT 
        'total_profiles'::TEXT,
        COUNT(*)::BIGINT,
        'Total user profiles'::TEXT
    FROM public.profiles
    
    UNION ALL
    
    SELECT 
        'total_schedules'::TEXT,
        COUNT(*)::BIGINT,
        'Total patient schedules'::TEXT
    FROM public.patient_schedules;
END;
$$;


ALTER FUNCTION "public"."get_db_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_encryption_key"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.encryption_key', true),
        'default-encryption-key-change-in-production'
    );
END;
$$;


ALTER FUNCTION "public"."get_encryption_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filter_statistics"("p_organization_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("total_patients" integer, "my_patients" integer, "total_schedules" integer, "today_schedules" integer, "overdue_schedules" integer, "upcoming_schedules" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_role TEXT;
    v_user_care_type TEXT;
    v_user_org_id UUID;
BEGIN
    -- SECURITY FIX 1: Verify caller is querying their own data
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot access other user statistics';
    END IF;

    -- Get user role, care_type, and organization_id
    SELECT role, care_type, organization_id INTO v_user_role, v_user_care_type, v_user_org_id
    FROM profiles
    WHERE id = p_user_id;

    -- SECURITY FIX 2: Verify user is member of requested organization
    IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    RETURN QUERY
    SELECT
        -- Total patients visible to user (filtered by organization)
        (SELECT COUNT(DISTINCT p.id)::INTEGER
         FROM patients p
         WHERE p.organization_id = p_organization_id
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- My patients (for doctors, filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM patients
         WHERE organization_id = p_organization_id
            AND doctor_id = p_user_id
        ),
        -- Total schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status IN ('active', 'paused')
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Today's schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date = CURRENT_DATE
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Overdue schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date < CURRENT_DATE
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Upcoming schedules (next 7 days, filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        );
END;
$$;


ALTER FUNCTION "public"."get_filter_statistics"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_schedules"("p_user_id" "uuid", "p_show_all" boolean DEFAULT false, "p_care_types" "text"[] DEFAULT NULL::"text"[], "p_date_start" "date" DEFAULT NULL::"date", "p_date_end" "date" DEFAULT NULL::"date") RETURNS TABLE("schedule_id" "uuid", "patient_id" "uuid", "patient_name" "text", "patient_care_type" "text", "patient_number" "text", "doctor_id" "uuid", "doctor_name" "text", "item_id" "uuid", "item_name" "text", "item_category" "text", "next_due_date" "date", "interval_weeks" integer, "priority" integer, "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "notes" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_role TEXT;
  v_user_care_type TEXT;
BEGIN
  SELECT role, care_type INTO v_user_role, v_user_care_type
  FROM profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    s.id as schedule_id,
    s.patient_id,
    p.name as patient_name,
    p.care_type as patient_care_type,
    p.patient_number,
    p.doctor_id,
    pr.name as doctor_name,
    s.item_id,
    i.name as item_name,
    i.category as item_category,
    s.next_due_date,
    s.interval_weeks,
    s.priority,
    s.status::TEXT,
    s.created_at,
    s.updated_at,
    s.notes
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  JOIN items i ON s.item_id = i.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  WHERE s.status IN ('active', 'paused')
  AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
  AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type)
  )
  AND (p_care_types IS NULL OR p.care_type = ANY(p_care_types))
  ORDER BY s.next_due_date, s.priority DESC;
END;
$$;


ALTER FUNCTION "public"."get_filtered_schedules"("p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[], "p_date_start" "date", "p_date_end" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_name" "text" NOT NULL,
    "nurse_id" "uuid",
    "appointment_type" "public"."appointment_type" DEFAULT 'consultation'::"public"."appointment_type" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" time without time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "notes" "text",
    "department" "text",
    "room_number" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_duration" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 480)))
);


ALTER TABLE "public"."patient_schedules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."patient_schedules"."scheduled_date" IS 'The scheduled date for the appointment. Can be a past date for historical records or data migration.';



CREATE OR REPLACE FUNCTION "public"."get_my_schedules"("start_date" "date" DEFAULT CURRENT_DATE, "end_date" "date" DEFAULT (CURRENT_DATE + '7 days'::interval)) RETURNS SETOF "public"."patient_schedules"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT s.* FROM public.patient_schedules s
    WHERE s.scheduled_date BETWEEN start_date AND end_date
    AND (s.nurse_id = auth.uid() OR s.created_by = auth.uid())
    ORDER BY s.scheduled_date, s.scheduled_time;
END;
$$;


ALTER FUNCTION "public"."get_my_schedules"("start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_execution_id UUID;
    v_organization_id UUID;
BEGIN
    -- Try to find existing execution
    SELECT id INTO v_execution_id
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id 
    AND planned_date = p_planned_date;
    
    -- If not found, create a new one
    IF v_execution_id IS NULL THEN
        -- Get organization_id from the schedule
        SELECT organization_id INTO v_organization_id
        FROM schedules
        WHERE id = p_schedule_id
        LIMIT 1;
        
        IF v_organization_id IS NULL THEN
            RAISE EXCEPTION 'Could not find organization_id for schedule %', p_schedule_id;
        END IF;
        
        INSERT INTO schedule_executions (
            schedule_id,
            planned_date,
            status,
            organization_id,  -- NEW: Include organization_id
            created_at,
            updated_at
        ) VALUES (
            p_schedule_id,
            p_planned_date,
            'planned'::execution_status,
            v_organization_id,  -- NEW: Use organization_id from schedule
            NOW(),
            NOW()
        )
        RETURNING id INTO v_execution_id;
        
        RAISE NOTICE 'Created new execution with organization_id %', v_organization_id;
    END IF;
    
    RETURN v_execution_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") IS 'Gets an existing execution record or creates a new one if it doesn''t exist.
Useful for ensuring an execution record exists before updating it.';



CREATE OR REPLACE FUNCTION "public"."get_pending_doctor_names"() RETURNS TABLE("name" "text", "patient_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.assigned_doctor_name as name,
    COUNT(*) as patient_count
  FROM patients p
  WHERE
    p.assigned_doctor_name IS NOT NULL
    AND p.doctor_id IS NULL
    AND NOT EXISTS (
      -- Exclude names that match registered doctors
      SELECT 1 FROM profiles prof
      WHERE prof.role = 'doctor'
      AND prof.name = p.assigned_doctor_name
    )
  GROUP BY p.assigned_doctor_name
  ORDER BY p.assigned_doctor_name;
END;
$$;


ALTER FUNCTION "public"."get_pending_doctor_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("schedule_id" "uuid", "total_pauses" integer, "total_pause_duration_days" integer, "last_pause_date" timestamp with time zone, "last_resume_date" timestamp with time zone, "missed_executions_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH pause_events AS (
        SELECT
            schedule_id,
            changed_at,
            (new_values->>'status')::TEXT AS new_status,
            (old_values->>'status')::TEXT AS old_status,
            LAG(changed_at) OVER (PARTITION BY schedule_id ORDER BY changed_at) AS prev_change
        FROM schedule_logs
        WHERE
            action = 'status_change'
            AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    ),
    pause_periods AS (
        SELECT
            schedule_id,
            COUNT(*) FILTER (WHERE old_status = 'active' AND new_status = 'paused') AS pause_count,
            MAX(CASE WHEN old_status = 'active' AND new_status = 'paused' THEN changed_at END) AS last_pause,
            MAX(CASE WHEN old_status = 'paused' AND new_status = 'active' THEN changed_at END) AS last_resume,
            SUM(
                CASE
                    WHEN old_status = 'paused' AND new_status = 'active'
                    THEN EXTRACT(EPOCH FROM (changed_at - prev_change))/86400
                    ELSE 0
                END
            )::INTEGER AS total_pause_days
        FROM pause_events
        GROUP BY schedule_id
    ),
    missed_stats AS (
        SELECT
            schedule_id,
            COUNT(*) AS missed_count
        FROM schedule_executions
        WHERE
            status = 'skipped'
            AND skipped_reason LIKE '%pause%'
            AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
        GROUP BY schedule_id
    )
    SELECT
        COALESCE(pp.schedule_id, ms.schedule_id) AS schedule_id,
        COALESCE(pp.pause_count, 0)::INTEGER AS total_pauses,
        COALESCE(pp.total_pause_days, 0)::INTEGER AS total_pause_duration_days,
        pp.last_pause AS last_pause_date,
        pp.last_resume AS last_resume_date,
        COALESCE(ms.missed_count, 0)::INTEGER AS missed_executions_count
    FROM pause_periods pp
    FULL OUTER JOIN missed_stats ms ON pp.schedule_id = ms.schedule_id;
END;
$$;


ALTER FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid") IS 'Returns pause/resume statistics for schedules including total pause duration and missed executions.';



CREATE OR REPLACE FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") RETURNS TABLE("total_executions" bigint, "completed_count" bigint, "skipped_count" bigint, "first_execution_date" "date", "last_execution_date" "date", "completion_rate" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT as completed_count,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END)::BIGINT as skipped_count,
        MIN(executed_date)::DATE as first_execution_date,
        MAX(executed_date)::DATE as last_execution_date,
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
            ELSE 0
        END as completion_rate
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id
    AND status IN ('completed', 'skipped');
END;
$$;


ALTER FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") IS 'Provides execution statistics for a specific schedule';



CREATE OR REPLACE FUNCTION "public"."get_today_checklist"("p_user_id" "uuid", "p_show_all" boolean DEFAULT false) RETURNS TABLE("schedule_id" "uuid", "patient_id" "uuid", "patient_name" "text", "patient_care_type" "text", "doctor_id" "uuid", "item_name" "text", "item_category" "text", "status" "text", "completed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_role TEXT;
    v_user_care_type TEXT;
BEGIN
    -- Get user role and care_type
    SELECT role, care_type INTO v_user_role, v_user_care_type
    FROM profiles
    WHERE id = p_user_id;

    RETURN QUERY
    SELECT
        s.id AS schedule_id,
        s.patient_id,
        p.name AS patient_name,
        p.care_type AS patient_care_type,
        p.doctor_id,
        i.name AS item_name,
        i.category AS item_category,
        s.status::TEXT,
        -- Check if completed today
        EXISTS (
            SELECT 1 FROM completions c
            WHERE c.schedule_id = s.id
            AND c.completed_at::DATE = CURRENT_DATE
        ) AS completed
    FROM schedules s
    INNER JOIN patients p ON s.patient_id = p.id
    INNER JOIN items i ON s.item_id = i.id
    WHERE
        s.next_due_date = CURRENT_DATE
        AND s.status = 'active'
        AND (
            v_user_role = 'admin'
            OR p_show_all = TRUE
            OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
            OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type)
        )
    ORDER BY
        -- Uncompleted items first
        completed ASC,
        p.care_type,
        p.name;
END;
$$;


ALTER FUNCTION "public"."get_today_checklist"("p_user_id" "uuid", "p_show_all" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") IS 'Helper function for audit trigger that bypasses RLS to fetch user profile data.
    Only used internally by audit_table_changes() trigger function.
    SECURITY DEFINER allows reading profiles regardless of RLS policies.';



CREATE OR REPLACE FUNCTION "public"."handle_auth_error"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Log auth errors but don't block operations
  IF auth.uid() IS NULL THEN
    RAISE WARNING 'Auth token might be expired or invalid, but allowing operation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_auth_error"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        RETURN new;
    END IF;
    
    INSERT INTO public.profiles (
        id, email, name, role, approval_status, is_active
    ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'nurse'),
        'pending',
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Profile creation failed for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_schedule_completion"("p_schedule_id" "uuid", "p_new_next_due_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
  v_schedule RECORD;
BEGIN
  -- Get schedule details
  SELECT
    ps.*,
    ns.name as nurse_name
  INTO v_schedule
  FROM public.schedules ps
  LEFT JOIN public.nurses ns ON ps.assigned_nurse_id = ns.id
  WHERE ps.id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Update schedule
  UPDATE public.schedules
  SET
    next_due_date = p_new_next_due_date,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_schedule_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Schedule completed successfully',
    'schedule_id', p_schedule_id,
    'next_due_date', p_new_next_due_date::text
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."handle_schedule_completion"("p_schedule_id" "uuid", "p_new_next_due_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_schedule_pause_flow"("p_schedule_id" "uuid", "p_action" "text", "p_new_next_due_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
  v_schedule RECORD;
BEGIN
  -- Get current schedule state with lock
  SELECT * INTO v_schedule
  FROM public.schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Perform action based on type
  IF p_action = 'pause' THEN
    IF v_schedule.status != 'active' THEN
      RAISE EXCEPTION 'Cannot pause schedule with status: %', v_schedule.status;
    END IF;

    UPDATE public.schedules
    SET
      status = 'paused',
      paused_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'pause',
      'message', 'Schedule paused successfully',
      'schedule_id', p_schedule_id
    );

  ELSIF p_action = 'resume' THEN
    IF v_schedule.status != 'paused' THEN
      RAISE EXCEPTION 'Cannot resume schedule with status: %', v_schedule.status;
    END IF;

    -- Removed: Past date validation check
    -- Allow any valid date to be set as next_due_date

    UPDATE public.schedules
    SET
      status = 'active',
      next_due_date = COALESCE(p_new_next_due_date, v_schedule.next_due_date),
      paused_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'resume',
      'message', 'Schedule resumed successfully',
      'schedule_id', p_schedule_id,
      'next_due_date', COALESCE(p_new_next_due_date, v_schedule.next_due_date)::TEXT
    );

  ELSE
    RAISE EXCEPTION 'Invalid action: %. Must be pause or resume', p_action;
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."handle_schedule_pause_flow"("p_schedule_id" "uuid", "p_action" "text", "p_new_next_due_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_schedule_state_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_planned_date DATE;
    v_end_date DATE;
    v_interval_weeks INTEGER;
    v_date_cursor DATE;
    v_count INTEGER := 0;
    v_organization_id UUID;  -- NEW: Variable to store organization_id
BEGIN
    -- Only process on status change to 'active' from 'paused'
    IF NEW.status = 'active' AND OLD.status = 'paused' THEN
        -- Get the schedule interval and organization_id
        v_interval_weeks := COALESCE(NEW.interval_weeks, OLD.interval_weeks, 1);
        v_organization_id := NEW.organization_id;  -- NEW: Get organization_id from schedule

        -- Ensure we have a valid interval
        IF v_interval_weeks <= 0 THEN
            v_interval_weeks := 1;
        END IF;
        
        -- Validate organization_id
        IF v_organization_id IS NULL THEN
            RAISE EXCEPTION 'Schedule % has no organization_id', NEW.id;
        END IF;

        -- Use cursor-based approach instead of generate_series to avoid conflicts
        v_date_cursor := NEW.next_due_date;
        v_end_date := COALESCE(NEW.end_date, CURRENT_DATE + INTERVAL '2 years');

        -- Create planned executions using a loop instead of generate_series
        WHILE v_date_cursor <= v_end_date AND v_count < 52 LOOP
            -- Check if execution already exists
            IF NOT EXISTS (
                SELECT 1 FROM schedule_executions
                WHERE schedule_id = NEW.id
                AND planned_date = v_date_cursor
                AND status = 'planned'
            ) THEN
                -- Insert new execution with organization_id
                INSERT INTO schedule_executions (
                    schedule_id,
                    planned_date,
                    status,
                    organization_id,  -- NEW: Include organization_id
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    v_date_cursor,
                    'planned',
                    v_organization_id,  -- NEW: Use organization_id from schedule
                    NOW(),
                    NOW()
                )
                ON CONFLICT (schedule_id, planned_date)
                DO UPDATE SET
                    status = CASE
                        WHEN schedule_executions.status = 'cancelled' THEN 'planned'
                        ELSE schedule_executions.status
                    END,
                    updated_at = NOW();
            END IF;

            -- Move to next date
            v_date_cursor := v_date_cursor + (v_interval_weeks * INTERVAL '1 week');
            v_count := v_count + 1;
        END LOOP;

        -- Update cancelled notifications back to pending (FIXED: using notify_date)
        UPDATE notifications
        SET state = 'pending',
            updated_at = NOW()
        WHERE schedule_id = NEW.id
        AND state = 'cancelled'
        AND notify_date >= NEW.next_due_date;
    END IF;

    -- Log the state change
    INSERT INTO schedule_logs (
        schedule_id,
        action,
        old_values,
        new_values,
        changed_at,
        changed_by
    )
    VALUES (
        NEW.id,
        'status_change',
        jsonb_build_object('status', OLD.status, 'next_due_date', OLD.next_due_date),
        jsonb_build_object('status', NEW.status, 'next_due_date', NEW.next_due_date),
        NOW(),
        auth.uid()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in handle_schedule_state_change: %', SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_schedule_state_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_schedule_state_change"() IS 'Trigger function that handles schedule state changes.
Uses loop-based approach instead of generate_series to avoid prepared statement conflicts.
Creates planned executions when resuming from paused state.';



CREATE OR REPLACE FUNCTION "public"."import_patients_csv"("p_csv_data" "text", "p_hospital_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("imported_count" integer, "error_count" integer, "errors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_imported integer := 0;
    v_errors integer := 0;
    v_error_details jsonb := '[]'::jsonb;
BEGIN
    -- TODO: CSV 파싱 및 임포트 로직 구현
    -- 1. CSV 데이터 파싱
    -- 2. 각 행 검증
    -- 3. 환자 정보 암호화
    -- 4. 데이터 삽입
    -- 5. 오류 처리 및 로깅
    
    RETURN QUERY
    SELECT v_imported, v_errors, v_error_details;
END;
$$;


ALTER FUNCTION "public"."import_patients_csv"("p_csv_data" "text", "p_hospital_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    user_role user_role;
BEGIN
    -- Direct query without RLS
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN user_role = 'admin';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_status approval_status;
BEGIN
    SELECT approval_status INTO user_status
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN user_status = 'approved';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."is_approved"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    user_is_admin boolean;
BEGIN
    SELECT (role = 'admin' AND approval_status = 'approved' AND is_active = true)
    INTO user_is_admin
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(user_is_admin, false);
END;
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_active_and_approved"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved'
    );
$$;


ALTER FUNCTION "public"."is_user_active_and_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Simply delegate to the properly named function
    RETURN public.is_current_user_admin();
END;
$$;


ALTER FUNCTION "public"."is_user_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_user_admin"() IS 'Backward compatibility alias for is_current_user_admin().
    Checks if the current authenticated user is an admin with approved status and is active.
    Uses SECURITY DEFINER to bypass RLS policies.';



CREATE OR REPLACE FUNCTION "public"."log_schedule_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Only log UPDATE operations
    -- DELETE operations are skipped to avoid FK violations
    -- since the schedule being deleted can't be referenced in logs
    IF TG_OP = 'UPDATE' THEN
        BEGIN
            -- Use fully qualified table name for security
            INSERT INTO public.schedule_logs (
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
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                -- This ensures data updates succeed even if logging fails
                RAISE WARNING 'Failed to log schedule change: %', SQLERRM;
        END;
        RETURN NEW;
    END IF;

    -- For any other operation, just return the appropriate record
    -- This should not happen with our trigger definition, but included for safety
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."log_schedule_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_admin_users_view"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Refresh the materialized view when role changes
    IF (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) OR 
       (TG_OP = 'INSERT' AND NEW.role = 'admin') OR
       (TG_OP = 'DELETE' AND OLD.role = 'admin') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY admin_users;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."refresh_admin_users_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_dashboard_summary"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_schedule_summary;
END;
$$;


ALTER FUNCTION "public"."refresh_dashboard_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_organization_id UUID;
    v_admin_org_id UUID;
    v_user_email TEXT;
    v_user_name TEXT;
BEGIN
    -- Verify admin permissions
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.';
    END IF;

    -- Get join request details including organization_id
    SELECT organization_id, email, name
    INTO v_organization_id, v_user_email, v_user_name
    FROM public.join_requests
    WHERE id = p_join_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '대기 중인 가입 신청을 찾을 수 없습니다.';
    END IF;

    -- SECURITY FIX: Get admin's organization
    SELECT organization_id INTO v_admin_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- SECURITY FIX: Verify admin's org matches request's org
    IF v_admin_org_id IS DISTINCT FROM v_organization_id THEN
        RAISE EXCEPTION 'Cannot process join requests for other organizations';
    END IF;

    -- Update join request
    UPDATE public.join_requests
    SET
        status = 'rejected',
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_join_request_id;

    -- Optionally update user profile with rejection reason
    IF p_rejection_reason IS NOT NULL THEN
        UPDATE public.profiles
        SET
            approval_status = 'rejected'::approval_status,
            rejection_reason = p_rejection_reason
        WHERE email = v_user_email;
    END IF;

    RAISE NOTICE '가입 신청 거부 완료: % (%)', v_user_name, v_user_email;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '가입 신청 거부 실패: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text") IS '가입 신청 거부 (관리자만, 동일 조직 내)';



CREATE OR REPLACE FUNCTION "public"."reject_user"("user_id" "uuid", "reason" "text" DEFAULT NULL::"text", "rejected_by_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can reject users';
    END IF;
    
    UPDATE public.profiles 
    SET approval_status = 'rejected', is_active = false, approved_by = rejected_by_id, approved_at = CURRENT_TIMESTAMP, rejection_reason = reason, updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."reject_user"("user_id" "uuid", "reason" "text", "rejected_by_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE patients 
    SET 
        archived = false,
        archived_at = NULL,
        is_active = true,
        patient_number = original_patient_number,
        original_patient_number = NULL,
        updated_at = now()
    WHERE id = patient_id AND archived = true;
END;
$$;


ALTER FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") IS 'Restores an archived patient by reverting to original patient number';



CREATE OR REPLACE FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text" DEFAULT NULL::"text", "update_care_type" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "patient_number" "text", "name" "text", "care_type" "text", "is_active" boolean, "archived" boolean, "archived_at" timestamp with time zone, "original_patient_number" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    current_patient_record RECORD;
    is_archived boolean;
    original_number text;
BEGIN
    -- Get current patient info to determine restoration strategy
    SELECT * INTO current_patient_record
    FROM patients 
    WHERE patients.id = patient_id;
    
    -- Check if patient exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient with ID % not found', patient_id;
    END IF;
    
    -- Store current archived status and original number
    is_archived := current_patient_record.archived;
    original_number := current_patient_record.original_patient_number;
    
    -- Perform atomic restore and update operation
    IF is_archived THEN
        -- Restore archived patient and apply optional updates
        UPDATE patients 
        SET 
            archived = false,
            archived_at = NULL,
            is_active = true,
            patient_number = COALESCE(original_number, patients.patient_number),
            original_patient_number = NULL,
            name = COALESCE(update_name, patients.name),
            care_type = COALESCE(update_care_type, patients.care_type),
            updated_at = now()
        WHERE patients.id = patient_id;
    ELSE
        -- Just reactivate soft-deleted patient and apply optional updates
        UPDATE patients 
        SET 
            is_active = true,
            name = COALESCE(update_name, patients.name),
            care_type = COALESCE(update_care_type, patients.care_type),
            updated_at = now()
        WHERE patients.id = patient_id;
    END IF;
    
    -- Return the updated patient record
    RETURN QUERY
    SELECT 
        p.id,
        p.patient_number,
        p.name,
        p.care_type,
        p.is_active,
        p.archived,
        p.archived_at,
        p.original_patient_number,
        p.metadata,
        p.created_at,
        p.updated_at
    FROM patients p
    WHERE p.id = patient_id;
END;
$$;


ALTER FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text", "update_care_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text", "update_care_type" "text") IS 'Atomically restores a patient and applies optional updates in a single transaction';



CREATE OR REPLACE FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) RETURNS TABLE("series_date" "date")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_current_date DATE;
    v_count INTEGER := 0;
    v_max_count INTEGER := 1000; -- Safety limit
BEGIN
    -- Input validation
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_interval_weeks IS NULL THEN
        RETURN;
    END IF;

    IF p_interval_weeks <= 0 THEN
        RETURN;
    END IF;

    IF p_start_date > p_end_date THEN
        RETURN;
    END IF;

    -- Generate dates using loop instead of generate_series
    v_current_date := p_start_date;

    WHILE v_current_date <= p_end_date AND v_count < v_max_count LOOP
        series_date := v_current_date;
        RETURN NEXT;

        v_current_date := v_current_date + (p_interval_weeks * INTERVAL '1 week');
        v_count := v_count + 1;
    END LOOP;

    RETURN;
END;
$$;


ALTER FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) IS 'Safe alternative to generate_series for date ranges.
Uses loop-based approach to avoid prepared statement conflicts.
Includes input validation and safety limits.';



CREATE OR REPLACE FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "created_at" timestamp with time zone, "member_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.created_at,
        COUNT(p.id) as member_count
    FROM public.organizations o
    LEFT JOIN public.profiles p ON p.organization_id = o.id
    WHERE o.name ILIKE '%' || p_search_term || '%'
    GROUP BY o.id, o.name, o.created_at
    ORDER BY o.name
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer) IS '조직명으로 조직 검색 (가입 신청 UI용)';



CREATE OR REPLACE FUNCTION "public"."set_organization_id_from_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If organization_id is not provided or is null, set it from current user
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
      LIMIT 1
    );
  END IF;
  
  -- Validate that the organization_id matches the user's organization
  IF NEW.organization_id != (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'organization_id mismatch: user organization_id does not match provided value';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_from_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_next_due_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_schedule schedules%ROWTYPE;
BEGIN
    -- 실행 완료 시에만 처리
    IF NEW.status = 'completed' AND NEW.executed_date IS NOT NULL THEN
        -- 일정 정보 조회
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;
        
        -- 다음 예정일 업데이트
        UPDATE schedules
        SET 
            last_executed_date = NEW.executed_date,
            next_due_date = calculate_next_due_date(
                v_schedule.interval_days, 
                NEW.executed_date
            ),
            updated_at = now()
        WHERE id = NEW.schedule_id;
        
        -- 다음 실행 계획 자동 생성
        INSERT INTO schedule_executions (
            schedule_id, 
            planned_date, 
            status
        )
        SELECT 
            NEW.schedule_id,
            calculate_next_due_date(
                v_schedule.interval_days, 
                NEW.executed_date
            ),
            'planned'
        ON CONFLICT (schedule_id, planned_date) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_next_due_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_patient_name_search"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- name_encrypted가 변경되었을 때 name_search 업데이트
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.name_encrypted IS DISTINCT FROM OLD.name_encrypted) THEN
        NEW.name_search := to_tsvector('simple', 
            COALESCE(
                decrypt_patient_data(NEW.name_encrypted),
                ''
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_patient_name_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_patient_search"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.name_encrypted IS NOT NULL THEN
        BEGIN
            NEW.name_search = to_tsvector('simple', decrypt_text(NEW.name_encrypted));
        EXCEPTION
            WHEN OTHERS THEN
                -- 복호화 실패 시 NULL 유지
                NEW.name_search = NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_patient_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_role user_role;
    updated_user JSON;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user departments';
    END IF;

    -- Update the target user's care_type
    UPDATE profiles
    SET
        care_type = new_care_type,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'role', role,
        'care_type', care_type
    ) INTO updated_user;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN updated_user;
END;
$$;


ALTER FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") IS 'Admin-only function to update a user''s department (care_type)';



CREATE OR REPLACE FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role" DEFAULT NULL::"public"."user_role", "new_care_type" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    current_user_role user_role;
    updated_user JSON;
    update_query TEXT;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user profiles';
    END IF;

    -- Prevent self role change for safety
    IF target_user_id = auth.uid() AND new_role IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot change your own role';
    END IF;

    -- Build dynamic update query
    update_query := 'UPDATE profiles SET updated_at = NOW()';

    IF new_role IS NOT NULL THEN
        update_query := update_query || ', role = $2';
    END IF;

    IF new_care_type IS NOT NULL THEN
        update_query := update_query || ', care_type = $3';
    END IF;

    update_query := update_query || ' WHERE id = $1 RETURNING json_build_object(
        ''id'', id,
        ''name'', name,
        ''email'', email,
        ''role'', role,
        ''care_type'', care_type,
        ''is_active'', is_active,
        ''approval_status'', approval_status
    )';

    -- Execute the update
    IF new_role IS NOT NULL AND new_care_type IS NOT NULL THEN
        EXECUTE update_query USING target_user_id, new_role, new_care_type INTO updated_user;
    ELSIF new_role IS NOT NULL THEN
        UPDATE profiles
        SET role = new_role, updated_at = NOW()
        WHERE id = target_user_id
        RETURNING json_build_object(
            'id', id,
            'name', name,
            'email', email,
            'role', role,
            'care_type', care_type,
            'is_active', is_active,
            'approval_status', approval_status
        ) INTO updated_user;
    ELSIF new_care_type IS NOT NULL THEN
        UPDATE profiles
        SET care_type = new_care_type, updated_at = NOW()
        WHERE id = target_user_id
        RETURNING json_build_object(
            'id', id,
            'name', name,
            'email', email,
            'role', role,
            'care_type', care_type,
            'is_active', is_active,
            'approval_status', approval_status
        ) INTO updated_user;
    END IF;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found or no changes made';
    END IF;

    RETURN updated_user;
END;
$_$;


ALTER FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role", "new_care_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role", "new_care_type" "text") IS 'Admin-only function to update user profile including role and care_type';



CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_role user_role;
    updated_user JSON;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user roles';
    END IF;

    -- Prevent self role change for safety
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot change your own role';
    END IF;

    -- Update the target user's role
    UPDATE profiles
    SET
        role = new_role,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'role', role,
        'care_type', care_type
    ) INTO updated_user;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN updated_user;
END;
$$;


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") IS 'Admin-only function to update a user''s role';



CREATE OR REPLACE FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    v_schedule RECORD;
    v_result JSONB;
    v_missed_count INTEGER := 0;
    v_pause_duration_weeks INTEGER := 0;
    v_validation_errors TEXT[] := ARRAY[]::TEXT[];
    v_warnings TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Input validation
    IF p_schedule_id IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Schedule ID is required'],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
    END IF;

    IF p_resume_date IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Resume date is required'],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
    END IF;

    -- Fetch schedule with error handling
    BEGIN
        SELECT * INTO v_schedule
        FROM schedules
        WHERE id = p_schedule_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'valid', false,
                'errors', ARRAY['Schedule not found'],
                'warnings', ARRAY[]::TEXT[],
                'missed_executions', 0,
                'pause_duration_weeks', 0
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'valid', false,
                'errors', ARRAY['Error fetching schedule: ' || SQLERRM],
                'warnings', ARRAY[]::TEXT[],
                'missed_executions', 0,
                'pause_duration_weeks', 0
            );
    END;

    -- Validate schedule status
    IF v_schedule.status != 'paused' THEN
        v_validation_errors := array_append(v_validation_errors,
            'Schedule must be paused to resume (current: ' || v_schedule.status || ')');
    END IF;

    -- Validate resume date
    IF p_resume_date < CURRENT_DATE THEN
        v_validation_errors := array_append(v_validation_errors,
            'Resume date cannot be in the past');
    END IF;

    -- Check end date
    IF v_schedule.end_date IS NOT NULL AND p_resume_date > v_schedule.end_date THEN
        v_validation_errors := array_append(v_validation_errors,
            'Resume date cannot be after schedule end date');
    END IF;

    -- Calculate pause duration (safe calculation)
    IF v_schedule.updated_at IS NOT NULL THEN
        v_pause_duration_weeks := GREATEST(0,
            EXTRACT(EPOCH FROM (p_resume_date - v_schedule.updated_at::date)) / 604800)::INTEGER;

        IF v_pause_duration_weeks > 52 THEN
            v_warnings := array_append(v_warnings,
                'Schedule has been paused for over a year');
        END IF;
    END IF;

    -- Calculate missed executions with safe generate_series
    IF v_schedule.next_due_date IS NOT NULL
       AND v_schedule.interval_weeks IS NOT NULL
       AND v_schedule.interval_weeks > 0
       AND v_schedule.next_due_date <= CURRENT_DATE THEN

        -- Use dynamic SQL to avoid prepared statement conflicts
        BEGIN
            EXECUTE format(
                'SELECT COUNT(*)::INTEGER FROM generate_series($1::date, $2::date, ($3 || '' weeks'')::interval) AS missed_date WHERE missed_date < $4::date'
            ) INTO v_missed_count
            USING v_schedule.next_due_date, CURRENT_DATE, v_schedule.interval_weeks, CURRENT_DATE;
        EXCEPTION
            WHEN OTHERS THEN
                -- If generate_series fails, log and continue
                RAISE WARNING 'Could not calculate missed executions: %', SQLERRM;
                v_missed_count := 0;
                v_warnings := array_append(v_warnings,
                    'Could not calculate exact missed executions');
        END;

        IF v_missed_count > 0 THEN
            v_warnings := array_append(v_warnings,
                format('%s executions were missed during pause', v_missed_count));
        END IF;
    END IF;

    -- Return validation result
    RETURN jsonb_build_object(
        'valid', array_length(v_validation_errors, 1) IS NULL OR array_length(v_validation_errors, 1) = 0,
        'errors', COALESCE(v_validation_errors, ARRAY[]::TEXT[]),
        'warnings', COALESCE(v_warnings, ARRAY[]::TEXT[]),
        'missed_executions', v_missed_count,
        'pause_duration_weeks', v_pause_duration_weeks,
        'schedule_info', jsonb_build_object(
            'id', v_schedule.id,
            'status', v_schedule.status,
            'next_due_date', v_schedule.next_due_date,
            'interval_weeks', v_schedule.interval_weeks,
            'end_date', v_schedule.end_date,
            'paused_at', v_schedule.updated_at
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Catch-all error handler
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Unexpected error: ' || SQLERRM],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
END;
$_$;


ALTER FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") IS 'Validates schedule resume with dynamic SQL to avoid prepared statement conflicts.
Uses EXECUTE for generate_series to prevent error 42P10.
Returns comprehensive validation result with error and warning messages.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "record_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "ip_address" "inet",
    "user_agent" "text",
    "user_name" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK (("operation" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."audit_logs"."user_name" IS 'Username captured at the time of the action to preserve historical context even if user is deleted';



COMMENT ON COLUMN "public"."audit_logs"."organization_id" IS '감사 로그가 속한 조직 ID';



CREATE TABLE IF NOT EXISTS "public"."schedule_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "planned_date" "date" NOT NULL,
    "executed_date" "date",
    "executed_time" time without time zone,
    "status" "public"."execution_status" DEFAULT 'planned'::"public"."execution_status",
    "executed_by" "uuid",
    "notes" "text",
    "skipped_reason" "text",
    "is_rescheduled" boolean DEFAULT false,
    "original_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "doctor_id_at_completion" "uuid",
    "care_type_at_completion" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "check_execution_completion" CHECK (((("status" = 'completed'::"public"."execution_status") AND ("executed_date" IS NOT NULL)) OR ("status" <> 'completed'::"public"."execution_status"))),
    CONSTRAINT "check_execution_date" CHECK (((("status" = 'completed'::"public"."execution_status") AND ("executed_date" IS NOT NULL)) OR ("status" <> 'completed'::"public"."execution_status")))
);


ALTER TABLE "public"."schedule_executions" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_executions" IS '검사/주사 실행 기록을 저장하는 테이블';



COMMENT ON COLUMN "public"."schedule_executions"."schedule_id" IS '연관된 스케줄 ID';



COMMENT ON COLUMN "public"."schedule_executions"."planned_date" IS '계획된 실행일';



COMMENT ON COLUMN "public"."schedule_executions"."executed_date" IS '실제 실행일';



COMMENT ON COLUMN "public"."schedule_executions"."status" IS '실행 상태 (planned, completed, skipped, cancelled)';



COMMENT ON COLUMN "public"."schedule_executions"."executed_by" IS '실행한 사용자 ID';



COMMENT ON COLUMN "public"."schedule_executions"."doctor_id_at_completion" IS 'Doctor assigned to patient when schedule was completed. Preserved for historical accuracy even if patient is later reassigned.';



COMMENT ON COLUMN "public"."schedule_executions"."care_type_at_completion" IS 'Care type of patient when schedule was completed. Preserved for historical accuracy even if patient care type changes.';



COMMENT ON COLUMN "public"."schedule_executions"."organization_id" IS '시행 기록이 속한 조직 ID';



CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "last_executed_date" "date",
    "next_due_date" "date" NOT NULL,
    "status" "public"."schedule_status" DEFAULT 'active'::"public"."schedule_status",
    "assigned_nurse_id" "uuid",
    "notes" "text",
    "priority" integer DEFAULT 0,
    "requires_notification" boolean DEFAULT false,
    "notification_days_before" integer DEFAULT 7,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "interval_weeks" integer NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "check_end_date" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "check_interval_weeks" CHECK ((("interval_weeks" > 0) AND ("interval_weeks" <= 52))),
    CONSTRAINT "check_next_due_date" CHECK (("next_due_date" >= "start_date")),
    CONSTRAINT "check_notification_interval" CHECK (((("interval_weeks" <= 1) AND ("requires_notification" = false)) OR ("interval_weeks" > 1))),
    CONSTRAINT "schedules_interval_weeks_check" CHECK ((("interval_weeks" IS NULL) OR ("interval_weeks" > 0))),
    CONSTRAINT "schedules_notification_days_before_check" CHECK (("notification_days_before" >= 0))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedules" IS '환자별 검사/주사 스케줄 정보를 저장하는 테이블';



COMMENT ON COLUMN "public"."schedules"."next_due_date" IS 'The next due date for the recurring schedule. Can be a past date for historical data or testing purposes.';



COMMENT ON COLUMN "public"."schedules"."interval_weeks" IS 'Interval in weeks between scheduled executions';



COMMENT ON COLUMN "public"."schedules"."organization_id" IS '일정이 속한 조직 ID';



CREATE OR REPLACE VIEW "public"."calendar_monthly_summary" AS
 SELECT ("date_trunc"('month'::"text", (COALESCE("s"."next_due_date", "se"."executed_date"))::timestamp with time zone))::"date" AS "month",
    "count"(DISTINCT "s"."id") FILTER (WHERE ("s"."status" = 'active'::"public"."schedule_status")) AS "active_schedules",
    "count"(DISTINCT "se"."id") FILTER (WHERE ("se"."status" = 'completed'::"public"."execution_status")) AS "completed_executions",
    "count"(DISTINCT "s"."patient_id") AS "unique_patients",
    "count"(DISTINCT "s"."item_id") AS "unique_items"
   FROM ("public"."schedules" "s"
     LEFT JOIN "public"."schedule_executions" "se" ON (("s"."id" = "se"."schedule_id")))
  WHERE ("s"."status" = ANY (ARRAY['active'::"public"."schedule_status", 'paused'::"public"."schedule_status", 'completed'::"public"."schedule_status"]))
  GROUP BY (("date_trunc"('month'::"text", (COALESCE("s"."next_due_date", "se"."executed_date"))::timestamp with time zone))::"date");


ALTER VIEW "public"."calendar_monthly_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."calendar_monthly_summary" IS 'Provides monthly summary statistics for calendar view';



CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "preparation_notes" "text",
    "requires_notification" boolean DEFAULT true,
    "notification_days_before" integer DEFAULT 7,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_interval_weeks" integer,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "items_category_check" CHECK (("category" = ANY (ARRAY['injection'::"text", 'test'::"text", 'other'::"text"]))),
    CONSTRAINT "items_default_interval_weeks_check" CHECK ((("default_interval_weeks" IS NULL) OR ("default_interval_weeks" > 0)))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."category" IS 'Category of the item: injection (주사), test (검사), other (기타)';



COMMENT ON COLUMN "public"."items"."default_interval_weeks" IS 'Default interval in weeks for the item';



COMMENT ON COLUMN "public"."items"."organization_id" IS '항목이 속한 조직 ID';



CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_number" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "care_type" "text",
    "archived" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "original_patient_number" "text",
    "doctor_id" "uuid",
    "assigned_doctor_name" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "patients_care_type_check" CHECK (("care_type" = ANY (ARRAY['외래'::"text", '입원'::"text", '낮병원'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."patients"."care_type" IS '진료구분: 외래, 입원, 낮병원 중 하나';



COMMENT ON COLUMN "public"."patients"."archived" IS 'Indicates if patient has been archived to resolve unique constraint conflicts';



COMMENT ON COLUMN "public"."patients"."archived_at" IS 'Timestamp when patient was archived';



COMMENT ON COLUMN "public"."patients"."original_patient_number" IS 'Original patient number before archiving (for restoration)';



COMMENT ON COLUMN "public"."patients"."doctor_id" IS 'ID of the doctor assigned to this patient. References profiles table.';



COMMENT ON COLUMN "public"."patients"."organization_id" IS '환자가 속한 조직 ID';



CREATE MATERIALIZED VIEW "public"."dashboard_schedule_summary" AS
 SELECT "s"."id" AS "schedule_id",
    "s"."patient_id",
    "p"."name" AS "patient_name",
    "p"."care_type",
    "p"."patient_number",
    "p"."doctor_id",
    "doc"."name" AS "doctor_name",
    "s"."item_id",
    "i"."name" AS "item_name",
    "i"."category" AS "item_category",
    "s"."next_due_date",
    "s"."status",
    "s"."interval_weeks",
    "s"."created_at",
    "s"."updated_at",
    "s"."notes",
        CASE
            WHEN ("s"."next_due_date" < CURRENT_DATE) THEN 'overdue'::"text"
            WHEN ("s"."next_due_date" = CURRENT_DATE) THEN 'due_today'::"text"
            WHEN ("s"."next_due_date" <= (CURRENT_DATE + '7 days'::interval)) THEN 'upcoming'::"text"
            ELSE 'future'::"text"
        END AS "urgency_level"
   FROM ((("public"."schedules" "s"
     JOIN "public"."patients" "p" ON (("s"."patient_id" = "p"."id")))
     JOIN "public"."items" "i" ON (("s"."item_id" = "i"."id")))
     LEFT JOIN "public"."profiles" "doc" ON (("p"."doctor_id" = "doc"."id")))
  WHERE ("s"."status" = ANY (ARRAY['active'::"public"."schedule_status", 'paused'::"public"."schedule_status"]))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."dashboard_schedule_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."dashboard_summary" AS
 WITH "today_stats" AS (
         SELECT "count"(*) FILTER (WHERE ("se"."status" = 'completed'::"public"."execution_status")) AS "completed_count",
            "count"(*) FILTER (WHERE ("se"."status" = 'planned'::"public"."execution_status")) AS "planned_count",
            "count"(*) FILTER (WHERE ("se"."status" = 'overdue'::"public"."execution_status")) AS "overdue_count",
            "count"(*) AS "total_count"
           FROM ("public"."schedule_executions" "se"
             JOIN "public"."schedules" "s" ON (("se"."schedule_id" = "s"."id")))
          WHERE (("se"."planned_date" = CURRENT_DATE) AND ("s"."status" = 'active'::"public"."schedule_status"))
        ), "upcoming_week" AS (
         SELECT "count"(DISTINCT "s"."id") AS "upcoming_schedules"
           FROM "public"."schedules" "s"
          WHERE ((("s"."next_due_date" >= (CURRENT_DATE + 1)) AND ("s"."next_due_date" <= (CURRENT_DATE + 7))) AND ("s"."status" = 'active'::"public"."schedule_status"))
        )
 SELECT "ts"."completed_count",
    "ts"."planned_count",
    "ts"."overdue_count",
    "ts"."total_count",
    "uw"."upcoming_schedules",
    "round"(
        CASE
            WHEN ("ts"."total_count" > 0) THEN ((("ts"."completed_count")::numeric / ("ts"."total_count")::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "completion_rate"
   FROM "today_stats" "ts",
    "upcoming_week" "uw";


ALTER VIEW "public"."dashboard_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'nurse'::"text" NOT NULL,
    "token" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."invitations" IS '사용자를 조직에 초대하기 위한 테이블입니다.';



COMMENT ON COLUMN "public"."invitations"."token" IS '초대 링크에 사용되는 고유 토큰';



CREATE TABLE IF NOT EXISTS "public"."join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'nurse'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."join_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."join_requests" IS '신규 사용자의 조직 가입 신청을 관리합니다.';



COMMENT ON COLUMN "public"."join_requests"."status" IS '가입 신청 상태: pending, approved, rejected';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "execution_id" "uuid",
    "recipient_id" "uuid" NOT NULL,
    "channel" "public"."notification_channel" NOT NULL,
    "notify_date" "date" NOT NULL,
    "notify_time" time without time zone DEFAULT '09:00:00'::time without time zone,
    "state" "public"."notification_state" DEFAULT 'pending'::"public"."notification_state",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "check_notification_reference" CHECK ((("schedule_id" IS NOT NULL) OR ("execution_id" IS NOT NULL)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS '스케줄 관련 알림을 저장하는 테이블';



COMMENT ON COLUMN "public"."notifications"."organization_id" IS '알림이 속한 조직 ID';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS '각 사용자 그룹(기관) 정보를 저장합니다.';



COMMENT ON COLUMN "public"."organizations"."name" IS '조직명 (검색 및 중복 방지용)';



CREATE OR REPLACE VIEW "public"."patient_doctor_view" AS
 SELECT "p"."id",
    "p"."patient_number",
    "p"."name" AS "patient_name",
    "p"."care_type",
    "p"."is_active",
    "p"."archived",
    "p"."created_at",
    "p"."updated_at",
    "p"."doctor_id",
    "p"."assigned_doctor_name",
    COALESCE("prof"."name", "p"."assigned_doctor_name", '미지정'::"text") AS "doctor_display_name",
        CASE
            WHEN ("p"."doctor_id" IS NOT NULL) THEN 'registered'::"text"
            WHEN ("p"."assigned_doctor_name" IS NOT NULL) THEN 'pending'::"text"
            ELSE 'unassigned'::"text"
        END AS "doctor_status",
    "prof"."email" AS "doctor_email",
    "prof"."role" AS "doctor_role",
    "prof"."approval_status" AS "doctor_approval_status"
   FROM ("public"."patients" "p"
     LEFT JOIN "public"."profiles" "prof" ON ((("p"."doctor_id" = "prof"."id") AND ("prof"."role" = 'doctor'::"public"."user_role"))));


ALTER VIEW "public"."patient_doctor_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."performance_metrics" AS
 SELECT "table_name",
    "pg_total_relation_size"((('public.'::"text" || ("table_name")::"text"))::"regclass") AS "total_size_bytes",
    "pg_size_pretty"("pg_total_relation_size"((('public.'::"text" || ("table_name")::"text"))::"regclass")) AS "total_size_pretty",
    "pg_relation_size"((('public.'::"text" || ("table_name")::"text"))::"regclass") AS "table_size_bytes",
    "pg_size_pretty"("pg_relation_size"((('public.'::"text" || ("table_name")::"text"))::"regclass")) AS "table_size_pretty",
        CASE
            WHEN (("table_name")::"name" = 'profiles'::"name") THEN ( SELECT "count"(*) AS "count"
               FROM "public"."profiles")
            WHEN (("table_name")::"name" = 'patient_schedules'::"name") THEN ( SELECT "count"(*) AS "count"
               FROM "public"."patient_schedules")
            WHEN (("table_name")::"name" = 'audit_logs'::"name") THEN ( SELECT "count"(*) AS "count"
               FROM "public"."audit_logs")
            ELSE (0)::bigint
        END AS "row_count"
   FROM "information_schema"."tables" "t"
  WHERE ((("table_schema")::"name" = 'public'::"name") AND (("table_type")::"text" = 'BASE TABLE'::"text"));


ALTER VIEW "public"."performance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."query_performance_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "query_type" "text" NOT NULL,
    "user_id" "uuid",
    "filter_params" "jsonb",
    "execution_time_ms" integer,
    "row_count" integer,
    "cache_hit" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."query_performance_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "reason" "text"
);


ALTER TABLE "public"."schedule_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_logs" IS '스케줄 관련 모든 활동 로그를 저장하는 테이블';



CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "show_all_patients" boolean DEFAULT false,
    "default_care_types" "text"[] DEFAULT '{}'::"text"[],
    "default_date_range_days" integer DEFAULT 7,
    "last_filter_state" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_schedules"
    ADD CONSTRAINT "patient_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."query_performance_log"
    ADD CONSTRAINT "query_performance_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "schedule_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_logs"
    ADD CONSTRAINT "schedule_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "unique_item_code_per_org" UNIQUE ("organization_id", "code");



COMMENT ON CONSTRAINT "unique_item_code_per_org" ON "public"."items" IS '조직별 항목 코드 고유성';



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "unique_schedule_date" UNIQUE ("schedule_id", "planned_date");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_audit_logs_organization" ON "public"."audit_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_logs_table_operation" ON "public"."audit_logs" USING "btree" ("table_name", "operation");



CREATE INDEX "idx_audit_logs_timestamp" ON "public"."audit_logs" USING "btree" ("timestamp");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_user_name" ON "public"."audit_logs" USING "btree" ("user_name");



CREATE INDEX "idx_dashboard_summary_care_type" ON "public"."dashboard_schedule_summary" USING "btree" ("care_type", "next_due_date");



CREATE INDEX "idx_dashboard_summary_doctor" ON "public"."dashboard_schedule_summary" USING "btree" ("doctor_id", "next_due_date");



CREATE INDEX "idx_dashboard_summary_urgency" ON "public"."dashboard_schedule_summary" USING "btree" ("urgency_level", "next_due_date");



CREATE INDEX "idx_executions_active_status" ON "public"."schedule_executions" USING "btree" ("planned_date", "status") WHERE ("status" = ANY (ARRAY['planned'::"public"."execution_status", 'overdue'::"public"."execution_status"]));



CREATE INDEX "idx_executions_calendar_range" ON "public"."schedule_executions" USING "btree" ("executed_date", "schedule_id") INCLUDE ("executed_by", "notes") WHERE ("status" = 'completed'::"public"."execution_status");



COMMENT ON INDEX "public"."idx_executions_calendar_range" IS 'Supports date range queries with included columns for covering index';



CREATE INDEX "idx_executions_executed_by" ON "public"."schedule_executions" USING "btree" ("executed_by");



CREATE INDEX "idx_executions_for_calendar" ON "public"."schedule_executions" USING "btree" ("executed_date", "schedule_id", "status") WHERE ("status" = 'completed'::"public"."execution_status");



COMMENT ON INDEX "public"."idx_executions_for_calendar" IS 'Optimizes calendar view queries for completed executions';



CREATE INDEX "idx_executions_planned" ON "public"."schedule_executions" USING "btree" ("planned_date", "status");



CREATE INDEX "idx_executions_schedule" ON "public"."schedule_executions" USING "btree" ("schedule_id");



CREATE INDEX "idx_executions_schedule_join" ON "public"."schedule_executions" USING "btree" ("schedule_id", "executed_date" DESC) WHERE ("status" = 'completed'::"public"."execution_status");



CREATE INDEX "idx_executions_schedule_status" ON "public"."schedule_executions" USING "btree" ("schedule_id", "status") WHERE ("status" = 'planned'::"public"."execution_status");



CREATE INDEX "idx_executions_status" ON "public"."schedule_executions" USING "btree" ("status");



CREATE INDEX "idx_invitations_organization" ON "public"."invitations" USING "btree" ("organization_id");



CREATE INDEX "idx_invitations_token" ON "public"."invitations" USING "btree" ("token");



CREATE UNIQUE INDEX "idx_invitations_unique_pending" ON "public"."invitations" USING "btree" ("organization_id", "email", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_items_active" ON "public"."items" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_items_category" ON "public"."items" USING "btree" ("category");



CREATE INDEX "idx_items_code" ON "public"."items" USING "btree" ("code");



CREATE INDEX "idx_items_organization" ON "public"."items" USING "btree" ("organization_id");



CREATE INDEX "idx_items_sort" ON "public"."items" USING "btree" ("sort_order");



CREATE INDEX "idx_join_requests_email" ON "public"."join_requests" USING "btree" ("email");



CREATE INDEX "idx_join_requests_organization" ON "public"."join_requests" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_join_requests_unique_pending" ON "public"."join_requests" USING "btree" ("organization_id", "email", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_notifications_execution_id" ON "public"."notifications" USING "btree" ("execution_id");



CREATE INDEX "idx_notifications_organization" ON "public"."notifications" USING "btree" ("organization_id");



CREATE INDEX "idx_notifications_pending_ready" ON "public"."notifications" USING "btree" ("state", "notify_date") WHERE ("state" = ANY (ARRAY['pending'::"public"."notification_state", 'ready'::"public"."notification_state"]));



CREATE INDEX "idx_notifications_ready" ON "public"."notifications" USING "btree" ("notify_date", "state") WHERE ("state" = ANY (ARRAY['pending'::"public"."notification_state", 'ready'::"public"."notification_state"]));



CREATE INDEX "idx_notifications_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "state");



CREATE INDEX "idx_notifications_schedule" ON "public"."notifications" USING "btree" ("schedule_id");



CREATE INDEX "idx_notifications_schedule_state" ON "public"."notifications" USING "btree" ("schedule_id", "state") WHERE ("state" = ANY (ARRAY['pending'::"public"."notification_state", 'ready'::"public"."notification_state"]));



CREATE INDEX "idx_notifications_state" ON "public"."notifications" USING "btree" ("state", "notify_date");



CREATE UNIQUE INDEX "idx_notifications_unique_execution_date" ON "public"."notifications" USING "btree" ("execution_id", "notify_date") WHERE ("execution_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_notifications_unique_execution_date" IS 'Ensures no duplicate notifications for the same execution';



CREATE UNIQUE INDEX "idx_notifications_unique_schedule_date" ON "public"."notifications" USING "btree" ("schedule_id", "notify_date") WHERE ("schedule_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_notifications_unique_schedule_date" IS 'Ensures no duplicate notifications for the same schedule on the same date';



CREATE INDEX "idx_patient_schedules_date_time" ON "public"."patient_schedules" USING "btree" ("scheduled_date", "scheduled_time");



CREATE INDEX "idx_patient_schedules_department_date" ON "public"."patient_schedules" USING "btree" ("department", "scheduled_date");



CREATE INDEX "idx_patients_active" ON "public"."patients" USING "btree" ("is_active");



CREATE INDEX "idx_patients_archived" ON "public"."patients" USING "btree" ("archived", "archived_at");



CREATE INDEX "idx_patients_assigned_doctor_name" ON "public"."patients" USING "btree" ("assigned_doctor_name") WHERE ("assigned_doctor_name" IS NOT NULL);



CREATE INDEX "idx_patients_care_type" ON "public"."patients" USING "btree" ("care_type");



CREATE INDEX "idx_patients_care_type_active" ON "public"."patients" USING "btree" ("care_type") WHERE (NOT "archived");



CREATE INDEX "idx_patients_care_type_doctor" ON "public"."patients" USING "btree" ("care_type", "doctor_id");



CREATE INDEX "idx_patients_created_at" ON "public"."patients" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_patients_created_by" ON "public"."patients" USING "btree" ("created_by");



CREATE INDEX "idx_patients_doctor_care_type" ON "public"."patients" USING "btree" ("doctor_id", "care_type") WHERE ("doctor_id" IS NOT NULL);



CREATE INDEX "idx_patients_doctor_id" ON "public"."patients" USING "btree" ("doctor_id");



CREATE INDEX "idx_patients_is_active" ON "public"."patients" USING "btree" ("is_active");



CREATE INDEX "idx_patients_name" ON "public"."patients" USING "btree" ("name");



CREATE INDEX "idx_patients_organization" ON "public"."patients" USING "btree" ("organization_id");



CREATE INDEX "idx_patients_original_number" ON "public"."patients" USING "btree" ("original_patient_number");



CREATE INDEX "idx_patients_patient_number" ON "public"."patients" USING "btree" ("patient_number");



CREATE INDEX "idx_performance_log_created" ON "public"."query_performance_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_performance_log_user" ON "public"."query_performance_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_profiles_active_role_dept" ON "public"."profiles" USING "btree" ("is_active", "role", "care_type") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_approved_by" ON "public"."profiles" USING "btree" ("approved_by");



CREATE INDEX "idx_profiles_id_role_care_type" ON "public"."profiles" USING "btree" ("id", "role", "care_type");



CREATE INDEX "idx_profiles_organization" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_profiles_role_care_type" ON "public"."profiles" USING "btree" ("role", "care_type") WHERE ("role" = 'nurse'::"public"."user_role");



CREATE INDEX "idx_profiles_role_department_active" ON "public"."profiles" USING "btree" ("role", "care_type", "is_active");



CREATE INDEX "idx_schedule_executions_care_type_completion" ON "public"."schedule_executions" USING "btree" ("care_type_at_completion", "executed_date") WHERE ("status" = 'completed'::"public"."execution_status");



CREATE INDEX "idx_schedule_executions_doctor_completion" ON "public"."schedule_executions" USING "btree" ("doctor_id_at_completion", "executed_date") WHERE ("status" = 'completed'::"public"."execution_status");



CREATE INDEX "idx_schedule_executions_organization" ON "public"."schedule_executions" USING "btree" ("organization_id");



CREATE INDEX "idx_schedule_logs_changed_at" ON "public"."schedule_logs" USING "btree" ("changed_at");



CREATE INDEX "idx_schedule_logs_changed_by" ON "public"."schedule_logs" USING "btree" ("changed_by");



CREATE INDEX "idx_schedule_logs_schedule" ON "public"."schedule_logs" USING "btree" ("schedule_id");



CREATE INDEX "idx_schedule_logs_schedule_action" ON "public"."schedule_logs" USING "btree" ("schedule_id", "action") WHERE ("action" = 'status_change'::"text");



CREATE INDEX "idx_schedule_logs_schedule_id" ON "public"."schedule_logs" USING "btree" ("schedule_id");



CREATE INDEX "idx_schedules_active_due_date" ON "public"."schedules" USING "btree" ("status", "next_due_date") WHERE ("status" = 'active'::"public"."schedule_status");



CREATE INDEX "idx_schedules_composite" ON "public"."schedules" USING "btree" ("patient_id", "next_due_date", "status");



CREATE INDEX "idx_schedules_created_by" ON "public"."schedules" USING "btree" ("created_by");



CREATE INDEX "idx_schedules_interval" ON "public"."schedules" USING "btree" ("interval_weeks");



CREATE INDEX "idx_schedules_item" ON "public"."schedules" USING "btree" ("item_id");



CREATE INDEX "idx_schedules_item_id" ON "public"."schedules" USING "btree" ("item_id");



CREATE INDEX "idx_schedules_next_due" ON "public"."schedules" USING "btree" ("next_due_date") WHERE ("status" = 'active'::"public"."schedule_status");



CREATE INDEX "idx_schedules_notification" ON "public"."schedules" USING "btree" ("next_due_date", "requires_notification") WHERE (("status" = 'active'::"public"."schedule_status") AND ("requires_notification" = true));



CREATE INDEX "idx_schedules_nurse" ON "public"."schedules" USING "btree" ("assigned_nurse_id") WHERE ("status" = 'active'::"public"."schedule_status");



CREATE INDEX "idx_schedules_organization" ON "public"."schedules" USING "btree" ("organization_id");



CREATE INDEX "idx_schedules_patient" ON "public"."schedules" USING "btree" ("patient_id");



CREATE INDEX "idx_schedules_patient_id" ON "public"."schedules" USING "btree" ("patient_id");



CREATE INDEX "idx_schedules_patient_status_date" ON "public"."schedules" USING "btree" ("patient_id", "status", "next_due_date") WHERE ("status" = ANY (ARRAY['active'::"public"."schedule_status", 'paused'::"public"."schedule_status"]));



CREATE INDEX "idx_schedules_status" ON "public"."schedules" USING "btree" ("status");



CREATE INDEX "idx_schedules_status_date" ON "public"."schedules" USING "btree" ("status", "next_due_date");



CREATE INDEX "idx_schedules_status_next_due" ON "public"."schedules" USING "btree" ("status", "next_due_date") WHERE ("status" = ANY (ARRAY['active'::"public"."schedule_status", 'paused'::"public"."schedule_status"]));



CREATE UNIQUE INDEX "idx_schedules_unique_active" ON "public"."schedules" USING "btree" ("patient_id", "item_id") WHERE ("status" = 'active'::"public"."schedule_status");



CREATE UNIQUE INDEX "unique_active_patient_number" ON "public"."patients" USING "btree" ("patient_number") WHERE (("is_active" = true) AND ("archived" = false));



CREATE UNIQUE INDEX "unique_patient_number_per_org" ON "public"."patients" USING "btree" ("organization_id", "patient_number") WHERE (("is_active" = true) AND ("archived" = false));



COMMENT ON INDEX "public"."unique_patient_number_per_org" IS '조직별 환자번호 고유성 (활성, 비보관 환자만)';



CREATE OR REPLACE TRIGGER "audit_patient_schedules_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."patient_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_patients_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_profiles_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_schedules_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "auto_link_doctor_on_profile_create" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_link_doctor_on_signup"();



CREATE OR REPLACE TRIGGER "capture_assignment_before_completion" BEFORE INSERT OR UPDATE ON "public"."schedule_executions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_assignment_at_completion"();



CREATE OR REPLACE TRIGGER "ensure_schedules_organization_id" BEFORE INSERT ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_user"();



CREATE OR REPLACE TRIGGER "trigger_calculate_next_due" AFTER INSERT OR UPDATE ON "public"."schedule_executions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_next_due_date"();



CREATE OR REPLACE TRIGGER "trigger_cascade_patient_soft_delete" AFTER UPDATE OF "is_active" ON "public"."patients" FOR EACH ROW WHEN ((("old"."is_active" = true) AND ("new"."is_active" = false))) EXECUTE FUNCTION "public"."cascade_patient_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_executions_updated_at" BEFORE UPDATE ON "public"."schedule_executions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_items_updated_at" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_log_schedule_changes" AFTER UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."log_schedule_changes"();



COMMENT ON TRIGGER "trigger_log_schedule_changes" ON "public"."schedules" IS 'Logs UPDATE operations on schedules table. DELETE operations are not logged to avoid FK violations.';



CREATE OR REPLACE TRIGGER "trigger_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_schedule_state_change" AFTER UPDATE ON "public"."schedules" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."handle_schedule_state_change"();



CREATE OR REPLACE TRIGGER "trigger_schedules_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_items_updated_at" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patient_schedules_updated_at" BEFORE UPDATE ON "public"."patient_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_schedule_executions_updated_at" BEFORE UPDATE ON "public"."schedule_executions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_schedules_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."schedule_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_schedules"
    ADD CONSTRAINT "patient_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_schedules"
    ADD CONSTRAINT "patient_schedules_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."query_performance_log"
    ADD CONSTRAINT "query_performance_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "schedule_executions_doctor_id_at_completion_fkey" FOREIGN KEY ("doctor_id_at_completion") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "schedule_executions_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "schedule_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_executions"
    ADD CONSTRAINT "schedule_executions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_logs"
    ADD CONSTRAINT "schedule_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_logs"
    ADD CONSTRAINT "schedule_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_assigned_nurse_id_fkey" FOREIGN KEY ("assigned_nurse_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete schedules" ON "public"."patient_schedules" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update all schedules" ON "public"."patient_schedules" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all schedules" ON "public"."patient_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING (("public"."is_user_admin"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "Anyone can create join requests" ON "public"."join_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view organizations for search" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view all notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view archived patients for restoration" ON "public"."patients" FOR SELECT TO "authenticated" USING (("archived" = true));



CREATE POLICY "Nurses can create schedules" ON "public"."patient_schedules" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['nurse'::"public"."user_role", 'admin'::"public"."user_role"])) AND ("profiles"."is_active" = true)))));



CREATE POLICY "Nurses can update own schedules" ON "public"."patient_schedules" FOR UPDATE USING (("nurse_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Nurses can view assigned schedules" ON "public"."patient_schedules" FOR SELECT USING (("nurse_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Nurses can view department schedules" ON "public"."patient_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'nurse'::"public"."user_role") AND ("profiles"."care_type" = "patient_schedules"."department")))));



CREATE POLICY "Only admins can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK ("public"."is_user_admin"());



CREATE POLICY "Only admins can delete organizations" ON "public"."organizations" FOR DELETE USING ("public"."is_user_admin"());



CREATE POLICY "Only admins can manage invitations" ON "public"."invitations" FOR INSERT WITH CHECK ("public"."is_user_admin"());



CREATE POLICY "Only admins can update invitations" ON "public"."invitations" FOR UPDATE USING ("public"."is_user_admin"());



CREATE POLICY "Only admins can update join requests" ON "public"."join_requests" FOR UPDATE USING ("public"."is_user_admin"());



CREATE POLICY "Only admins can update organizations" ON "public"."organizations" FOR UPDATE USING ("public"."is_user_admin"());



CREATE POLICY "System can insert schedule logs" ON "public"."schedule_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Trigger can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert schedule logs" ON "public"."schedule_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can update notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((("recipient_id" = "auth"."uid"()) OR true)) WITH CHECK (true);



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update schedule logs" ON "public"."schedule_logs" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can view all schedule logs" ON "public"."schedule_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("recipient_id" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "schedules"."created_by"
   FROM "public"."schedules"
  WHERE ("schedules"."id" = "notifications"."schedule_id"))) OR true));



CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own invitations" ON "public"."invitations" FOR SELECT USING ((("email" = ("auth"."jwt"() ->> 'email'::"text")) OR "public"."is_user_admin"()));



CREATE POLICY "Users can view their own join requests" ON "public"."join_requests" FOR SELECT USING ((("email" = ("auth"."jwt"() ->> 'email'::"text")) OR "public"."is_user_admin"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_users_update_patients" ON "public"."patients" FOR UPDATE TO "authenticated" USING (("public"."is_user_active_and_approved"() AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'nurse'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'doctor'::"public"."user_role"))))))) WITH CHECK (("public"."is_user_active_and_approved"() AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'nurse'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'doctor'::"public"."user_role")))))));



COMMENT ON POLICY "authenticated_users_update_patients" ON "public"."patients" IS 'Allows admin, nurse, and doctor roles to update patient records including doctor_id assignment';



CREATE POLICY "executions_secure_delete" ON "public"."schedule_executions" FOR DELETE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "executions_secure_insert" ON "public"."schedule_executions" FOR INSERT WITH CHECK (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "executions_secure_select" ON "public"."schedule_executions" FOR SELECT USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "executions_secure_update" ON "public"."schedule_executions" FOR UPDATE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_secure_delete" ON "public"."items" FOR DELETE USING (("public"."is_user_admin"() AND "public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "items_secure_insert" ON "public"."items" FOR INSERT WITH CHECK (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"()) AND ("public"."is_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['doctor'::"public"."user_role", 'nurse'::"public"."user_role"]))))))));



COMMENT ON POLICY "items_secure_insert" ON "public"."items" IS 'Allow admins to create any items, and doctors/nurses to create custom items for their organization';



CREATE POLICY "items_secure_select" ON "public"."items" FOR SELECT USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "items_secure_update" ON "public"."items" FOR UPDATE USING (("public"."is_user_admin"() AND "public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



ALTER TABLE "public"."join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_secure_select" ON "public"."notifications" FOR SELECT USING (((("recipient_id" = "auth"."uid"()) OR "public"."is_user_admin"()) AND ("organization_id" = "public"."get_current_user_organization_id"())));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patients_secure_delete" ON "public"."patients" FOR DELETE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "patients_secure_insert" ON "public"."patients" FOR INSERT WITH CHECK (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "patients_secure_select" ON "public"."patients" FOR SELECT USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "patients_secure_update" ON "public"."patients" FOR UPDATE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_org_admin" ON "public"."profiles" FOR SELECT USING (("public"."is_current_user_admin"() AND ("organization_id" = "public"."get_current_user_org_id"())));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_service_role_all" ON "public"."profiles" USING (("current_setting"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "profiles_update_org_admin" ON "public"."profiles" FOR UPDATE USING (("public"."is_current_user_admin"() AND ("organization_id" = "public"."get_current_user_org_id"()))) WITH CHECK (("public"."is_current_user_admin"() AND ("organization_id" = "public"."get_current_user_org_id"())));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."schedule_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_secure_delete" ON "public"."schedules" FOR DELETE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "schedules_secure_insert" ON "public"."schedules" FOR INSERT WITH CHECK ("public"."is_user_active_and_approved"());



COMMENT ON POLICY "schedules_secure_insert" ON "public"."schedules" IS 'Allow active and approved users to insert schedules. Organization ID is enforced by trigger.';



CREATE POLICY "schedules_secure_select" ON "public"."schedules" FOR SELECT USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "schedules_secure_update" ON "public"."schedules" FOR UPDATE USING (("public"."is_user_active_and_approved"() AND ("organization_id" = "public"."get_current_user_organization_id"())));



CREATE POLICY "system_manage_notifications" ON "public"."notifications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role") AND ("profiles"."is_active" = true)))));



CREATE POLICY "unified_patients_delete_policy" ON "public"."patients" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role") AND ("profiles"."is_active" = true) AND ("profiles"."approval_status" = 'approved'::"public"."approval_status")))));



COMMENT ON POLICY "unified_patients_delete_policy" ON "public"."patients" IS 'Allows only admin users to perform hard deletes. Soft deletes are handled via UPDATE.';



CREATE POLICY "unified_patients_insert_policy" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_active" = true) AND ("profiles"."approval_status" = 'approved'::"public"."approval_status")))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'nurse'::"public"."user_role", 'doctor'::"public"."user_role"])))))));



COMMENT ON POLICY "unified_patients_insert_policy" ON "public"."patients" IS 'Allows active and approved admin, nurse, and doctor roles to create new patient records.';



CREATE POLICY "unified_patients_select_policy" ON "public"."patients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_active" = true) AND ("profiles"."approval_status" = 'approved'::"public"."approval_status")))));



COMMENT ON POLICY "unified_patients_select_policy" ON "public"."patients" IS 'Allows all active and approved users to view patient records. Role-based filtering is handled at the application layer.';



CREATE POLICY "unified_patients_update_policy" ON "public"."patients" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_active" = true) AND ("profiles"."approval_status" = 'approved'::"public"."approval_status")))) AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'nurse'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'doctor'::"public"."user_role"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_active" = true) AND ("profiles"."approval_status" = 'approved'::"public"."approval_status")))) AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'nurse'::"public"."user_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'doctor'::"public"."user_role")))))));



COMMENT ON POLICY "unified_patients_update_policy" ON "public"."patients" IS 'Allows active and approved admin, nurse, and doctor roles to update any patient record, including doctor_id assignment. This consolidates all update permissions into a single policy to avoid conflicts.';



ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_view_own_notifications" ON "public"."notifications" FOR SELECT USING (("recipient_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_target_role" "text", "p_remaining_admins" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_assigned_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_user"("user_id" "uuid", "approved_by_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_user"("user_id" "uuid", "approved_by_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_user"("user_id" "uuid", "approved_by_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_patient_with_timestamp"("patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_doctor_on_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_doctor_on_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_doctor_on_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_archive_patients"("patient_ids" "uuid"[], "archive_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_due_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_due_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_due_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_due_date"("p_interval_days" integer, "p_reference_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_due_date"("p_interval_days" integer, "p_reference_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_due_date"("p_interval_days" integer, "p_reference_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_assignment_at_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_assignment_at_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_assignment_at_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_patient_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_patient_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_patient_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_role_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_role_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_role_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_schedule_conflict"("p_nurse_id" "uuid", "p_scheduled_date" "date", "p_scheduled_time" time without time zone, "p_duration_minutes" integer, "p_exclude_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_schedule_conflict"("p_nurse_id" "uuid", "p_scheduled_date" "date", "p_scheduled_time" time without time zone, "p_duration_minutes" integer, "p_exclude_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_schedule_conflict"("p_nurse_id" "uuid", "p_scheduled_date" "date", "p_scheduled_time" time without time zone, "p_duration_minutes" integer, "p_exclude_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_schedule_execution"("p_schedule_id" "uuid", "p_planned_date" "date", "p_executed_date" "date", "p_executed_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_bulk_schedules"("p_patient_ids" "uuid"[], "p_item_id" "uuid", "p_interval_days" integer, "p_start_date" "date", "p_assigned_nurse_id" "uuid", "p_requires_notification" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_bulk_schedules"("p_patient_ids" "uuid"[], "p_item_id" "uuid", "p_interval_days" integer, "p_start_date" "date", "p_assigned_nurse_id" "uuid", "p_requires_notification" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_bulk_schedules"("p_patient_ids" "uuid"[], "p_item_id" "uuid", "p_interval_days" integer, "p_start_date" "date", "p_assigned_nurse_id" "uuid", "p_requires_notification" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_and_register_user"("p_organization_name" "text", "p_user_id" "uuid", "p_user_name" "text", "p_user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_schedule_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_schedule_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_schedule_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_user"("user_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_user"("user_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_user"("user_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_patient_data"("encrypted_data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_patient_data"("encrypted_data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_patient_data"("encrypted_data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_text"("encrypted_data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_patient_data"("plain_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_patient_data"("plain_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_patient_data"("plain_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_text"("plain_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_text"("plain_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_text"("plain_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_recurring_events"("p_schedule_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_recurring_events"("p_schedule_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_recurring_events"("p_schedule_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_schedules"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_schedules_filtered"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_schedules_filtered"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_schedules_filtered"("p_start_date" "date", "p_end_date" "date", "p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_organization_id"() TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_db_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_db_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_db_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_encryption_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_encryption_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_encryption_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filter_statistics"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_filter_statistics"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filter_statistics"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_schedules"("p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[], "p_date_start" "date", "p_date_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_schedules"("p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[], "p_date_start" "date", "p_date_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_schedules"("p_user_id" "uuid", "p_show_all" boolean, "p_care_types" "text"[], "p_date_start" "date", "p_date_end" "date") TO "service_role";



GRANT ALL ON TABLE "public"."patient_schedules" TO "anon";
GRANT ALL ON TABLE "public"."patient_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_schedules" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_schedules"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_schedules"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_schedules"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_execution"("p_schedule_id" "uuid", "p_planned_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_doctor_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_doctor_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_doctor_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_schedule_pause_statistics"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_schedule_statistics"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_today_checklist"("p_user_id" "uuid", "p_show_all" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_today_checklist"("p_user_id" "uuid", "p_show_all" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_today_checklist"("p_user_id" "uuid", "p_show_all" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_error"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_error"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_error"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_schedule_completion"("p_schedule_id" "uuid", "p_new_next_due_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_schedule_completion"("p_schedule_id" "uuid", "p_new_next_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_schedule_completion"("p_schedule_id" "uuid", "p_new_next_due_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_schedule_pause_flow"("p_schedule_id" "uuid", "p_action" "text", "p_new_next_due_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_schedule_pause_flow"("p_schedule_id" "uuid", "p_action" "text", "p_new_next_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_schedule_pause_flow"("p_schedule_id" "uuid", "p_action" "text", "p_new_next_due_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_schedule_state_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_schedule_state_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_schedule_state_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."import_patients_csv"("p_csv_data" "text", "p_hospital_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."import_patients_csv"("p_csv_data" "text", "p_hospital_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_patients_csv"("p_csv_data" "text", "p_hospital_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_active_and_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_active_and_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_active_and_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_schedule_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_schedule_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_schedule_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_schedule_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_admin_users_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_admin_users_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_admin_users_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_dashboard_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_join_request"("p_join_request_id" "uuid", "p_admin_id" "uuid", "p_rejection_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_user"("user_id" "uuid", "reason" "text", "rejected_by_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_user"("user_id" "uuid", "reason" "text", "rejected_by_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_user"("user_id" "uuid", "reason" "text", "rejected_by_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_archived_patient"("patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text", "update_care_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text", "update_care_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_patient_atomic"("patient_id" "uuid", "update_name" "text", "update_care_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_date_series"("p_start_date" "date", "p_end_date" "date", "p_interval_weeks" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_organizations"("p_search_term" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_from_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_from_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_from_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_next_due_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_next_due_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_next_due_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_patient_name_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_patient_name_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_patient_name_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_patient_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_patient_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_patient_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_care_type"("target_user_id" "uuid", "new_care_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role", "new_care_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role", "new_care_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_admin"("target_user_id" "uuid", "new_role" "public"."user_role", "new_care_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."user_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_schedule_resume"("p_schedule_id" "uuid", "p_resume_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_executions" TO "anon";
GRANT ALL ON TABLE "public"."schedule_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_executions" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_monthly_summary" TO "anon";
GRANT ALL ON TABLE "public"."calendar_monthly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_monthly_summary" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_schedule_summary" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_schedule_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_schedule_summary" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_summary" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."join_requests" TO "anon";
GRANT ALL ON TABLE "public"."join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."patient_doctor_view" TO "anon";
GRANT ALL ON TABLE "public"."patient_doctor_view" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_doctor_view" TO "service_role";



GRANT ALL ON TABLE "public"."performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."query_performance_log" TO "anon";
GRANT ALL ON TABLE "public"."query_performance_log" TO "authenticated";
GRANT ALL ON TABLE "public"."query_performance_log" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_logs" TO "anon";
GRANT ALL ON TABLE "public"."schedule_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






