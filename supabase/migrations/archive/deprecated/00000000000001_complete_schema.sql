-- ============================================================================
-- Complete Schema Migration
-- Generated: 2025-09-28
-- Description: Complete reproducible schema for medical scheduling system
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. Enum Types
-- ============================================================================
CREATE TYPE appointment_type AS ENUM ('consultation', 'treatment', 'follow_up', 'emergency', 'routine_check');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE execution_status AS ENUM ('planned', 'completed', 'skipped', 'overdue');
CREATE TYPE notification_channel AS ENUM ('dashboard', 'push', 'email');
CREATE TYPE notification_state AS ENUM ('pending', 'ready', 'sent', 'failed', 'cancelled');
CREATE TYPE schedule_status AS ENUM ('active', 'paused', 'completed', 'deleted', 'cancelled');
CREATE TYPE user_role AS ENUM ('nurse', 'admin', 'doctor');

-- ============================================================================
-- 3. Tables (with columns only, constraints come later)
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid,
    email text,
    name text,
    role user_role DEFAULT 'nurse'::user_role,
    care_type text,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    approval_status approval_status DEFAULT 'pending'::approval_status,
    approved_by uuid,
    approved_at timestamptz,
    rejection_reason text
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id uuid DEFAULT gen_random_uuid(),
    code text,
    name text,
    category text,
    description text,
    instructions text,
    preparation_notes text,
    requires_notification boolean DEFAULT true,
    notification_days_before integer DEFAULT 7,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    default_interval_weeks integer
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id uuid DEFAULT gen_random_uuid(),
    patient_number text,
    name text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    care_type text,
    archived boolean DEFAULT false,
    archived_at timestamptz,
    original_patient_number text,
    doctor_id uuid
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id uuid DEFAULT gen_random_uuid(),
    patient_id uuid,
    item_id uuid,
    start_date date,
    end_date date,
    last_executed_date date,
    next_due_date date,
    status schedule_status DEFAULT 'active'::schedule_status,
    assigned_nurse_id uuid,
    notes text,
    priority integer DEFAULT 0,
    requires_notification boolean DEFAULT false,
    notification_days_before integer DEFAULT 7,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    interval_weeks integer
);

-- Schedule executions table
CREATE TABLE IF NOT EXISTS schedule_executions (
    id uuid DEFAULT gen_random_uuid(),
    schedule_id uuid,
    planned_date date,
    executed_date date,
    executed_time time,
    status execution_status DEFAULT 'planned'::execution_status,
    executed_by uuid,
    notes text,
    skipped_reason text,
    is_rescheduled boolean DEFAULT false,
    original_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    doctor_id_at_completion uuid,
    care_type_at_completion text
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid DEFAULT gen_random_uuid(),
    schedule_id uuid,
    execution_id uuid,
    recipient_id uuid,
    channel notification_channel,
    notify_date date,
    notify_time time DEFAULT '09:00:00'::time,
    state notification_state DEFAULT 'pending'::notification_state,
    title text,
    message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Schedule logs table
CREATE TABLE IF NOT EXISTS schedule_logs (
    id uuid DEFAULT gen_random_uuid(),
    schedule_id uuid,
    action text,
    old_values jsonb,
    new_values jsonb,
    changed_by uuid,
    changed_at timestamptz DEFAULT now(),
    reason text
);

-- Patient schedules table
CREATE TABLE IF NOT EXISTS patient_schedules (
    id uuid DEFAULT gen_random_uuid(),
    patient_name text,
    nurse_id uuid,
    appointment_type appointment_type DEFAULT 'consultation'::appointment_type,
    scheduled_date date,
    scheduled_time time,
    duration_minutes integer DEFAULT 30,
    notes text,
    department text,
    room_number text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid(),
    table_name text,
    operation text,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    user_id uuid,
    user_email text,
    user_role text,
    timestamp timestamptz DEFAULT now(),
    ip_address inet,
    user_agent text
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id uuid,
    show_all_patients boolean DEFAULT false,
    default_care_types text[] DEFAULT '{}'::text[],
    default_date_range_days integer DEFAULT 7,
    last_filter_state jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Query performance log table
CREATE TABLE IF NOT EXISTS query_performance_log (
    id uuid DEFAULT gen_random_uuid(),
    query_type text,
    user_id uuid,
    filter_params jsonb,
    execution_time_ms integer,
    row_count integer,
    cache_hit boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. Primary Keys
-- ============================================================================
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS profiles_pkey PRIMARY KEY (id);
ALTER TABLE items ADD CONSTRAINT IF NOT EXISTS items_pkey PRIMARY KEY (id);
ALTER TABLE patients ADD CONSTRAINT IF NOT EXISTS patients_pkey PRIMARY KEY (id);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_pkey PRIMARY KEY (id);
ALTER TABLE schedule_executions ADD CONSTRAINT IF NOT EXISTS schedule_executions_pkey PRIMARY KEY (id);
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS notifications_pkey PRIMARY KEY (id);
ALTER TABLE schedule_logs ADD CONSTRAINT IF NOT EXISTS schedule_logs_pkey PRIMARY KEY (id);
ALTER TABLE patient_schedules ADD CONSTRAINT IF NOT EXISTS patient_schedules_pkey PRIMARY KEY (id);
ALTER TABLE audit_logs ADD CONSTRAINT IF NOT EXISTS audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE user_preferences ADD CONSTRAINT IF NOT EXISTS user_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE query_performance_log ADD CONSTRAINT IF NOT EXISTS query_performance_log_pkey PRIMARY KEY (id);

-- ============================================================================
-- 5. Unique Constraints
-- ============================================================================
ALTER TABLE items ADD CONSTRAINT IF NOT EXISTS items_code_key UNIQUE (code);
ALTER TABLE unique_active_patient_number DROP CONSTRAINT IF EXISTS unique_active_patient_number;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_patient_number ON patients (patient_number) WHERE (is_active = true AND archived = false);
CREATE UNIQUE INDEX IF NOT EXISTS unique_schedule_date ON schedule_executions (schedule_id, planned_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique_active ON schedules (patient_id, item_id) WHERE (status = 'active'::schedule_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_schedule_date ON notifications (schedule_id, notify_date) WHERE (schedule_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_execution_date ON notifications (execution_id, notify_date) WHERE (execution_id IS NOT NULL);

-- ============================================================================
-- 6. Check Constraints
-- ============================================================================

-- Items constraints
ALTER TABLE items ADD CONSTRAINT IF NOT EXISTS items_category_check
    CHECK (category = ANY (ARRAY['injection'::text, 'test'::text, 'treatment'::text, 'medication'::text, 'other'::text]));
ALTER TABLE items ADD CONSTRAINT IF NOT EXISTS items_default_interval_weeks_check
    CHECK (default_interval_weeks IS NULL OR default_interval_weeks > 0);

-- Patients constraints
ALTER TABLE patients ADD CONSTRAINT IF NOT EXISTS patients_care_type_check
    CHECK (care_type = ANY (ARRAY['외래'::text, '입원'::text, '낮병원'::text]));

-- Profiles constraints
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS check_role_care_type
    CHECK (
        (role = 'nurse'::user_role AND care_type = ANY (ARRAY['외래'::text, '입원'::text, '낮병원'::text])) OR
        (role = ANY (ARRAY['admin'::user_role, 'doctor'::user_role]) AND care_type IS NULL)
    );

-- Schedules constraints
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_interval_weeks_check
    CHECK (interval_weeks IS NULL OR interval_weeks > 0);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_notification_days_before_check
    CHECK (notification_days_before >= 0);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS check_end_date
    CHECK (end_date IS NULL OR end_date >= start_date);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS check_next_due_date
    CHECK (next_due_date >= start_date);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS check_interval_weeks
    CHECK (interval_weeks > 0 AND interval_weeks <= 52);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS check_notification_interval
    CHECK ((interval_weeks <= 1 AND requires_notification = false) OR interval_weeks > 1);

-- Schedule executions constraints
ALTER TABLE schedule_executions ADD CONSTRAINT IF NOT EXISTS check_execution_completion
    CHECK ((status = 'completed'::execution_status AND executed_date IS NOT NULL) OR status <> 'completed'::execution_status);

-- Notifications constraints
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS check_notification_reference
    CHECK (schedule_id IS NOT NULL OR execution_id IS NOT NULL);

-- Patient schedules constraints
ALTER TABLE patient_schedules ADD CONSTRAINT IF NOT EXISTS valid_duration
    CHECK (duration_minutes > 0 AND duration_minutes <= 480);

-- ============================================================================
-- 7. Foreign Keys
-- ============================================================================

-- Profiles foreign keys
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS profiles_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id);

-- Patients foreign keys
ALTER TABLE patients ADD CONSTRAINT IF NOT EXISTS patients_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE patients ADD CONSTRAINT IF NOT EXISTS patients_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES profiles(id);

-- Schedules foreign keys
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES items(id);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_assigned_nurse_id_fkey
    FOREIGN KEY (assigned_nurse_id) REFERENCES profiles(id);
ALTER TABLE schedules ADD CONSTRAINT IF NOT EXISTS schedules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);

-- Schedule executions foreign keys
ALTER TABLE schedule_executions ADD CONSTRAINT IF NOT EXISTS schedule_executions_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE schedule_executions ADD CONSTRAINT IF NOT EXISTS schedule_executions_executed_by_fkey
    FOREIGN KEY (executed_by) REFERENCES profiles(id);
ALTER TABLE schedule_executions ADD CONSTRAINT IF NOT EXISTS schedule_executions_doctor_id_at_completion_fkey
    FOREIGN KEY (doctor_id_at_completion) REFERENCES profiles(id);

-- Notifications foreign keys
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS notifications_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS notifications_execution_id_fkey
    FOREIGN KEY (execution_id) REFERENCES schedule_executions(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS notifications_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES profiles(id);

-- Schedule logs foreign keys
ALTER TABLE schedule_logs ADD CONSTRAINT IF NOT EXISTS schedule_logs_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE schedule_logs ADD CONSTRAINT IF NOT EXISTS schedule_logs_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES profiles(id);

-- Patient schedules foreign keys
ALTER TABLE patient_schedules ADD CONSTRAINT IF NOT EXISTS patient_schedules_nurse_id_fkey
    FOREIGN KEY (nurse_id) REFERENCES profiles(id);
ALTER TABLE patient_schedules ADD CONSTRAINT IF NOT EXISTS patient_schedules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);

-- Audit logs foreign keys
ALTER TABLE audit_logs ADD CONSTRAINT IF NOT EXISTS audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- User preferences foreign keys
ALTER TABLE user_preferences ADD CONSTRAINT IF NOT EXISTS user_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Query performance log foreign keys
ALTER TABLE query_performance_log ADD CONSTRAINT IF NOT EXISTS query_performance_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id);

-- ============================================================================
-- 8. Indexes
-- ============================================================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_items_code ON items (code);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
CREATE INDEX IF NOT EXISTS idx_items_active ON items (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_items_sort ON items (sort_order);

-- Patients indexes
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients (patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (name);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (is_active);
CREATE INDEX IF NOT EXISTS idx_patients_care_type ON patients (care_type);
CREATE INDEX IF NOT EXISTS idx_patients_care_type_active ON patients (care_type) WHERE (NOT archived);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients (doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_care_type ON patients (doctor_id, care_type) WHERE (doctor_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_patients_care_type_doctor ON patients (care_type, doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_archived ON patients (archived, archived_at);
CREATE INDEX IF NOT EXISTS idx_patients_original_number ON patients (original_patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients (created_by);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_is_active ON patients (is_active);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role_care_type ON profiles (role, care_type) WHERE (role = 'nurse'::user_role);
CREATE INDEX IF NOT EXISTS idx_profiles_role_department_active ON profiles (role, care_type, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_active_role_dept ON profiles (is_active, role, care_type) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_profiles_approved_by ON profiles (approved_by);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role_care_type ON profiles (id, role, care_type);

-- Schedules indexes
CREATE INDEX IF NOT EXISTS idx_schedules_patient_id ON schedules (patient_id);
CREATE INDEX IF NOT EXISTS idx_schedules_item_id ON schedules (item_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules (status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_due ON schedules (next_due_date) WHERE (status = 'active'::schedule_status);
CREATE INDEX IF NOT EXISTS idx_schedules_active_due_date ON schedules (status, next_due_date) WHERE (status = 'active'::schedule_status);
CREATE INDEX IF NOT EXISTS idx_schedules_status_date ON schedules (status, next_due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status_next_due ON schedules (status, next_due_date) WHERE (status = ANY (ARRAY['active'::schedule_status, 'paused'::schedule_status]));
CREATE INDEX IF NOT EXISTS idx_schedules_patient_status_date ON schedules (patient_id, status, next_due_date) WHERE (status = ANY (ARRAY['active'::schedule_status, 'paused'::schedule_status]));
CREATE INDEX IF NOT EXISTS idx_schedules_nurse ON schedules (assigned_nurse_id) WHERE (status = 'active'::schedule_status);
CREATE INDEX IF NOT EXISTS idx_schedules_notification ON schedules (next_due_date, requires_notification) WHERE (status = 'active'::schedule_status AND requires_notification = true);
CREATE INDEX IF NOT EXISTS idx_schedules_composite ON schedules (patient_id, next_due_date, status);
CREATE INDEX IF NOT EXISTS idx_schedules_interval ON schedules (interval_weeks);
CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules (created_by);

-- Schedule executions indexes
CREATE INDEX IF NOT EXISTS idx_executions_schedule ON schedule_executions (schedule_id);
CREATE INDEX IF NOT EXISTS idx_executions_planned ON schedule_executions (planned_date, status);
CREATE INDEX IF NOT EXISTS idx_executions_status ON schedule_executions (status);
CREATE INDEX IF NOT EXISTS idx_executions_executed_by ON schedule_executions (executed_by);
CREATE INDEX IF NOT EXISTS idx_executions_active_status ON schedule_executions (planned_date, status) WHERE (status = ANY (ARRAY['planned'::execution_status, 'overdue'::execution_status]));
CREATE INDEX IF NOT EXISTS idx_executions_schedule_status ON schedule_executions (schedule_id, status) WHERE (status = 'planned'::execution_status);
CREATE INDEX IF NOT EXISTS idx_executions_schedule_join ON schedule_executions (schedule_id, executed_date DESC) WHERE (status = 'completed'::execution_status);
CREATE INDEX IF NOT EXISTS idx_executions_for_calendar ON schedule_executions (executed_date, schedule_id, status) WHERE (status = 'completed'::execution_status);
CREATE INDEX IF NOT EXISTS idx_executions_calendar_range ON schedule_executions (executed_date, schedule_id) INCLUDE (executed_by, notes) WHERE (status = 'completed'::execution_status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_doctor_completion ON schedule_executions (doctor_id_at_completion, executed_date) WHERE (status = 'completed'::execution_status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_care_type_completion ON schedule_executions (care_type_at_completion, executed_date) WHERE (status = 'completed'::execution_status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_schedule ON notifications (schedule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_execution_id ON notifications (execution_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, state);
CREATE INDEX IF NOT EXISTS idx_notifications_state ON notifications (state, notify_date);
CREATE INDEX IF NOT EXISTS idx_notifications_ready ON notifications (notify_date, state) WHERE (state = ANY (ARRAY['pending'::notification_state, 'ready'::notification_state]));
CREATE INDEX IF NOT EXISTS idx_notifications_pending_ready ON notifications (state, notify_date) WHERE (state = ANY (ARRAY['pending'::notification_state, 'ready'::notification_state]));
CREATE INDEX IF NOT EXISTS idx_notifications_schedule_state ON notifications (schedule_id, state) WHERE (state = ANY (ARRAY['pending'::notification_state, 'ready'::notification_state]));

-- Schedule logs indexes
CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule_id ON schedule_logs (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_logs_changed_at ON schedule_logs (changed_at);
CREATE INDEX IF NOT EXISTS idx_schedule_logs_changed_by ON schedule_logs (changed_by);
CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule_action ON schedule_logs (schedule_id, action) WHERE (action = 'status_change'::text);

-- Patient schedules indexes
CREATE INDEX IF NOT EXISTS idx_patient_schedules_date_time ON patient_schedules (scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_patient_schedules_department_date ON patient_schedules (department, scheduled_date);

-- Query performance log indexes
CREATE INDEX IF NOT EXISTS idx_performance_log_created ON query_performance_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_log_user ON query_performance_log (user_id, created_at DESC);

-- ============================================================================
-- 9. Functions
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Alternative update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- User role checking functions
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true AND approval_status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION is_user_active_and_approved()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION is_approved(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

-- User approval functions
CREATE OR REPLACE FUNCTION approve_user(user_id uuid, approved_by_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Audit logging functions
CREATE OR REPLACE FUNCTION audit_profiles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile public.profiles;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

    -- Log the operation
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
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
             WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
             ELSE NULL END,
        auth.uid(),
        user_profile.email,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION audit_schedules_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile public.profiles;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

    -- Log the operation
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
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
             WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
             ELSE NULL END,
        auth.uid(),
        user_profile.email,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Schedule management functions
CREATE OR REPLACE FUNCTION calculate_next_due_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_schedule RECORD;
BEGIN
    -- Only process when execution is completed
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- Get the schedule details
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
            INSERT INTO notifications (
                schedule_id,
                recipient_id,
                channel,
                notify_date,
                title,
                message
            ) VALUES (
                NEW.schedule_id,
                COALESCE(v_schedule.assigned_nurse_id, v_schedule.created_by),
                'dashboard'::notification_channel,
                (NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval -
                 (v_schedule.notification_days_before || ' days')::interval)::date,
                '일정 알림',
                format('예정된 일정이 %s일 후 도래합니다.', v_schedule.notification_days_before)
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION capture_assignment_at_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION log_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
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

CREATE OR REPLACE FUNCTION handle_schedule_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_planned_date DATE;
    v_end_date DATE;
    v_interval_weeks INTEGER;
    v_date_cursor DATE;
    v_count INTEGER := 0;
BEGIN
    -- Only process on status change to 'active' from 'paused'
    IF NEW.status = 'active' AND OLD.status = 'paused' THEN
        -- Get the schedule interval
        v_interval_weeks := COALESCE(NEW.interval_weeks, OLD.interval_weeks, 1);

        -- Ensure we have a valid interval
        IF v_interval_weeks <= 0 THEN
            v_interval_weeks := 1;
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
                -- Insert new execution
                INSERT INTO schedule_executions (
                    schedule_id,
                    planned_date,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    v_date_cursor,
                    'planned',
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

CREATE OR REPLACE FUNCTION cascade_patient_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
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

-- ============================================================================
-- 10. Triggers
-- ============================================================================

-- Updated at triggers
CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_schedule_executions_updated_at
    BEFORE UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_patient_schedules_updated_at
    BEFORE UPDATE ON patient_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER IF NOT EXISTS audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_profiles_changes();

CREATE TRIGGER IF NOT EXISTS audit_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patient_schedules
    FOR EACH ROW EXECUTE FUNCTION audit_schedules_changes();

-- Schedule management triggers
CREATE TRIGGER IF NOT EXISTS trigger_calculate_next_due
    AFTER INSERT OR UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION calculate_next_due_date();

CREATE TRIGGER IF NOT EXISTS capture_assignment_before_completion
    BEFORE INSERT OR UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION capture_assignment_at_completion();

CREATE TRIGGER IF NOT EXISTS trigger_log_schedule_changes
    AFTER UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION log_schedule_changes();

CREATE TRIGGER IF NOT EXISTS trigger_schedule_state_change
    AFTER UPDATE ON schedules
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_schedule_state_change();

-- Patient cascade trigger
CREATE TRIGGER IF NOT EXISTS trigger_cascade_patient_soft_delete
    AFTER UPDATE OF is_active ON patients
    FOR EACH ROW WHEN ((OLD.is_active = true) AND (NEW.is_active = false))
    EXECUTE FUNCTION cascade_patient_soft_delete();

-- Auth trigger (if not already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 11. Views
-- ============================================================================

-- Calendar monthly summary view
CREATE OR REPLACE VIEW calendar_monthly_summary AS
SELECT
    (date_trunc('month'::text, (COALESCE(s.next_due_date, se.executed_date))::timestamp with time zone))::date AS month,
    count(DISTINCT s.id) FILTER (WHERE (s.status = 'active'::schedule_status)) AS active_schedules,
    count(DISTINCT se.id) FILTER (WHERE (se.status = 'completed'::execution_status)) AS completed_executions,
    count(DISTINCT s.patient_id) AS unique_patients,
    count(DISTINCT s.item_id) AS unique_items
FROM (schedules s
    LEFT JOIN schedule_executions se ON ((s.id = se.schedule_id)))
WHERE (s.status = ANY (ARRAY['active'::schedule_status, 'paused'::schedule_status, 'completed'::schedule_status]))
GROUP BY ((date_trunc('month'::text, (COALESCE(s.next_due_date, se.executed_date))::timestamp with time zone))::date);

-- Dashboard summary view
CREATE OR REPLACE VIEW dashboard_summary AS
WITH today_stats AS (
    SELECT
        count(*) FILTER (WHERE (se.status = 'completed'::execution_status)) AS completed_count,
        count(*) FILTER (WHERE (se.status = 'planned'::execution_status)) AS planned_count,
        count(*) FILTER (WHERE (se.status = 'overdue'::execution_status)) AS overdue_count,
        count(*) AS total_count
    FROM (schedule_executions se
        JOIN schedules s ON ((se.schedule_id = s.id)))
    WHERE ((se.planned_date = CURRENT_DATE) AND (s.status = 'active'::schedule_status))
), upcoming_week AS (
    SELECT count(DISTINCT s.id) AS upcoming_schedules
    FROM schedules s
    WHERE (((s.next_due_date >= (CURRENT_DATE + 1)) AND (s.next_due_date <= (CURRENT_DATE + 7))) AND (s.status = 'active'::schedule_status))
)
SELECT
    ts.completed_count,
    ts.planned_count,
    ts.overdue_count,
    ts.total_count,
    uw.upcoming_schedules,
    round(
        CASE
            WHEN (ts.total_count > 0) THEN (((ts.completed_count)::numeric / (ts.total_count)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS completion_rate
FROM today_stats ts, upcoming_week uw;

-- Performance metrics view
CREATE OR REPLACE VIEW performance_metrics AS
SELECT
    table_name,
    pg_total_relation_size((('public.'::text || (table_name)::text))::regclass) AS total_size_bytes,
    pg_size_pretty(pg_total_relation_size((('public.'::text || (table_name)::text))::regclass)) AS total_size_pretty,
    pg_relation_size((('public.'::text || (table_name)::text))::regclass) AS table_size_bytes,
    pg_size_pretty(pg_relation_size((('public.'::text || (table_name)::text))::regclass)) AS table_size_pretty,
    CASE
        WHEN ((table_name)::name = 'profiles'::name) THEN ( SELECT count(*) AS count FROM profiles)
        WHEN ((table_name)::name = 'patient_schedules'::name) THEN ( SELECT count(*) AS count FROM patient_schedules)
        WHEN ((table_name)::name = 'audit_logs'::name) THEN ( SELECT count(*) AS count FROM audit_logs)
        ELSE (0)::bigint
    END AS row_count
FROM information_schema.tables t
WHERE (((table_schema)::name = 'public'::name) AND ((table_type)::text = 'BASE TABLE'::text));

-- ============================================================================
-- 12. Materialized Views
-- ============================================================================

-- Dashboard schedule summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_schedule_summary AS
SELECT
    s.id AS schedule_id,
    s.patient_id,
    p.name AS patient_name,
    p.care_type,
    p.patient_number,
    p.doctor_id,
    doc.name AS doctor_name,
    s.item_id,
    i.name AS item_name,
    i.category AS item_category,
    s.next_due_date,
    s.status,
    s.interval_weeks,
    s.created_at,
    s.updated_at,
    s.notes,
    CASE
        WHEN (s.next_due_date < CURRENT_DATE) THEN 'overdue'::text
        WHEN (s.next_due_date = CURRENT_DATE) THEN 'due_today'::text
        WHEN (s.next_due_date <= (CURRENT_DATE + '7 days'::interval)) THEN 'upcoming'::text
        ELSE 'future'::text
    END AS urgency_level
FROM (((schedules s
    JOIN patients p ON ((s.patient_id = p.id)))
    JOIN items i ON ((s.item_id = i.id)))
    LEFT JOIN profiles doc ON ((p.doctor_id = doc.id)))
WHERE (s.status = ANY (ARRAY['active'::schedule_status, 'paused'::schedule_status]));

-- Indexes for materialized view
CREATE INDEX IF NOT EXISTS idx_dashboard_summary_care_type ON dashboard_schedule_summary (care_type, next_due_date);
CREATE INDEX IF NOT EXISTS idx_dashboard_summary_doctor ON dashboard_schedule_summary (doctor_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_dashboard_summary_urgency ON dashboard_schedule_summary (urgency_level, next_due_date);

-- ============================================================================
-- 13. RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Service role full access" ON profiles FOR ALL
    USING ((current_setting('role'::text) = 'service_role'::text));

DROP POLICY IF EXISTS "all_users_can_view_profiles" ON profiles;
CREATE POLICY "all_users_can_view_profiles" ON profiles FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
    TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_secure_insert" ON profiles;
CREATE POLICY "profiles_secure_insert" ON profiles FOR INSERT
    TO authenticated WITH CHECK ((current_setting('role'::text) = 'service_role'::text) OR is_user_admin());

DROP POLICY IF EXISTS "profiles_secure_delete" ON profiles;
CREATE POLICY "profiles_secure_delete" ON profiles FOR DELETE
    TO authenticated USING (is_user_admin());

-- Items policies
DROP POLICY IF EXISTS "items_secure_select" ON items;
CREATE POLICY "items_secure_select" ON items FOR SELECT
    TO authenticated USING (is_user_active_and_approved());

DROP POLICY IF EXISTS "items_secure_insert" ON items;
CREATE POLICY "items_secure_insert" ON items FOR INSERT
    TO authenticated WITH CHECK (is_user_admin());

DROP POLICY IF EXISTS "items_secure_update" ON items;
CREATE POLICY "items_secure_update" ON items FOR UPDATE
    TO authenticated USING (is_user_admin()) WITH CHECK (is_user_admin());

DROP POLICY IF EXISTS "items_secure_delete" ON items;
CREATE POLICY "items_secure_delete" ON items FOR DELETE
    TO authenticated USING (is_user_admin());

-- Patients policies
DROP POLICY IF EXISTS "unified_patients_select_policy" ON patients;
CREATE POLICY "unified_patients_select_policy" ON patients FOR SELECT
    TO authenticated USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved'
    ));

DROP POLICY IF EXISTS "unified_patients_insert_policy" ON patients;
CREATE POLICY "unified_patients_insert_policy" ON patients FOR INSERT
    TO authenticated WITH CHECK (
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved')) AND
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin'::user_role, 'nurse'::user_role, 'doctor'::user_role])))
    );

DROP POLICY IF EXISTS "unified_patients_update_policy" ON patients;
CREATE POLICY "unified_patients_update_policy" ON patients FOR UPDATE
    TO authenticated
    USING (
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved')) AND
        ((EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) OR
         (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'nurse')) OR
         (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor')))
    )
    WITH CHECK (
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true AND approval_status = 'approved')) AND
        ((EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) OR
         (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'nurse')) OR
         (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor')))
    );

DROP POLICY IF EXISTS "unified_patients_delete_policy" ON patients;
CREATE POLICY "unified_patients_delete_policy" ON patients FOR DELETE
    TO authenticated USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true AND approval_status = 'approved'
    ));

DROP POLICY IF EXISTS "Authenticated users can view archived patients for restoration" ON patients;
CREATE POLICY "Authenticated users can view archived patients for restoration" ON patients FOR SELECT
    TO authenticated USING (archived = true);

-- Schedules policies
DROP POLICY IF EXISTS "schedules_secure_select" ON schedules;
CREATE POLICY "schedules_secure_select" ON schedules FOR SELECT
    TO authenticated USING (is_user_active_and_approved());

DROP POLICY IF EXISTS "schedules_secure_insert" ON schedules;
CREATE POLICY "schedules_secure_insert" ON schedules FOR INSERT
    TO authenticated WITH CHECK (is_user_active_and_approved());

DROP POLICY IF EXISTS "schedules_secure_update" ON schedules;
CREATE POLICY "schedules_secure_update" ON schedules FOR UPDATE
    TO authenticated USING (is_user_active_and_approved()) WITH CHECK (is_user_active_and_approved());

DROP POLICY IF EXISTS "schedules_secure_delete" ON schedules;
CREATE POLICY "schedules_secure_delete" ON schedules FOR DELETE
    TO authenticated USING (is_user_active_and_approved());

-- Schedule executions policies
DROP POLICY IF EXISTS "executions_secure_select" ON schedule_executions;
CREATE POLICY "executions_secure_select" ON schedule_executions FOR SELECT
    TO authenticated USING (is_user_active_and_approved());

DROP POLICY IF EXISTS "executions_secure_insert" ON schedule_executions;
CREATE POLICY "executions_secure_insert" ON schedule_executions FOR INSERT
    TO authenticated WITH CHECK (is_user_active_and_approved());

DROP POLICY IF EXISTS "executions_secure_update" ON schedule_executions;
CREATE POLICY "executions_secure_update" ON schedule_executions FOR UPDATE
    TO authenticated USING (is_user_active_and_approved()) WITH CHECK (is_user_active_and_approved());

DROP POLICY IF EXISTS "executions_secure_delete" ON schedule_executions;
CREATE POLICY "executions_secure_delete" ON schedule_executions FOR DELETE
    TO authenticated USING (is_user_active_and_approved());

-- Notifications policies
DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
CREATE POLICY "users_view_own_notifications" ON notifications FOR SELECT
    TO public USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT
    TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
CREATE POLICY "Users can update notifications" ON notifications FOR UPDATE
    TO authenticated USING ((recipient_id = auth.uid()) OR true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view all notifications" ON notifications;
CREATE POLICY "Authenticated users can view all notifications" ON notifications FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Trigger can insert notifications" ON notifications;
CREATE POLICY "Trigger can insert notifications" ON notifications FOR INSERT
    TO public WITH CHECK (true);

-- Schedule logs policies
DROP POLICY IF EXISTS "Users can view all schedule logs" ON schedule_logs;
CREATE POLICY "Users can view all schedule logs" ON schedule_logs FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert schedule logs" ON schedule_logs;
CREATE POLICY "Users can insert schedule logs" ON schedule_logs FOR INSERT
    TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert schedule logs" ON schedule_logs;
CREATE POLICY "System can insert schedule logs" ON schedule_logs FOR INSERT
    TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update schedule logs" ON schedule_logs;
CREATE POLICY "Users can update schedule logs" ON schedule_logs FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

-- Patient schedules policies
DROP POLICY IF EXISTS "Admins can view all schedules" ON patient_schedules;
CREATE POLICY "Admins can view all schedules" ON patient_schedules FOR SELECT
    TO public USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Nurses can view assigned schedules" ON patient_schedules;
CREATE POLICY "Nurses can view assigned schedules" ON patient_schedules FOR SELECT
    TO public USING (nurse_id = auth.uid());

DROP POLICY IF EXISTS "Nurses can view department schedules" ON patient_schedules;
CREATE POLICY "Nurses can view department schedules" ON patient_schedules FOR SELECT
    TO public USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'nurse' AND care_type = patient_schedules.department
    ));

DROP POLICY IF EXISTS "Nurses can create schedules" ON patient_schedules;
CREATE POLICY "Nurses can create schedules" ON patient_schedules FOR INSERT
    TO public WITH CHECK (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = ANY (ARRAY['nurse'::user_role, 'admin'::user_role]) AND is_active = true
    ));

DROP POLICY IF EXISTS "Nurses can update own schedules" ON patient_schedules;
CREATE POLICY "Nurses can update own schedules" ON patient_schedules FOR UPDATE
    TO public USING (nurse_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update all schedules" ON patient_schedules;
CREATE POLICY "Admins can update all schedules" ON patient_schedules FOR UPDATE
    TO public USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Admins can delete schedules" ON patient_schedules;
CREATE POLICY "Admins can delete schedules" ON patient_schedules FOR DELETE
    TO public USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Audit logs policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT
    TO public USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- User preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT
    TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT
    TO public WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE
    TO public USING (auth.uid() = user_id);

COMMIT;