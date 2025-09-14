-- Security fix: Add safe search_path to all SECURITY DEFINER functions
-- This migration ensures all SECURITY DEFINER functions use safe search_path settings
-- to prevent SQL injection through search_path manipulation

BEGIN;

-- =====================================================
-- 1. Fix encrypt_text function - add safe search_path
-- =====================================================
CREATE OR REPLACE FUNCTION encrypt_text(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(plain_text, current_setting('app.encryption_key'));
END;
$$;

-- =====================================================
-- 2. Fix decrypt_text function - add safe search_path
-- =====================================================
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
END;
$$;

-- =====================================================
-- 3. Fix get_today_checklist function - add safe search_path
-- =====================================================
CREATE OR REPLACE FUNCTION get_today_checklist(p_nurse_id uuid DEFAULT NULL)
RETURNS TABLE (
    schedule_id uuid,
    patient_name text,
    patient_number text,
    item_name text,
    item_category text,
    next_due_date date,
    interval_days integer,
    priority integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id as schedule_id,
        decrypt_text(p.name_encrypted) as patient_name,
        decrypt_text(p.patient_number_encrypted) as patient_number,
        i.name as item_name,
        i.category as item_category,
        s.next_due_date,
        s.interval_weeks as interval_days, -- Updated to use interval_weeks
        s.priority
    FROM schedules s
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    WHERE s.status = 'active'::schedule_status
        AND s.next_due_date <= CURRENT_DATE
        AND (p_nurse_id IS NULL OR s.assigned_nurse_id = p_nurse_id)
    ORDER BY s.priority DESC, s.next_due_date ASC;
END;
$$;

-- =====================================================
-- 4. Fix validate_schedule_resume function - already has safe search_path
-- =====================================================
-- This function already has SET search_path = public, but let's ensure it's consistent

CREATE OR REPLACE FUNCTION validate_schedule_resume(
    p_schedule_id UUID,
    p_new_next_due_date DATE
)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT,
    warnings TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule RECORD;
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_missed_count INTEGER;
BEGIN
    -- Get schedule details
    SELECT * INTO v_schedule FROM schedules WHERE id = p_schedule_id;

    -- Check if schedule exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'Schedule not found',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if schedule is paused
    IF v_schedule.status != 'paused'::schedule_status THEN
        RETURN QUERY SELECT
            FALSE,
            'Schedule is not paused',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if new date is in the past
    IF p_new_next_due_date < CURRENT_DATE THEN
        RETURN QUERY SELECT
            FALSE,
            'Next due date cannot be in the past',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Check if new date exceeds end date
    IF v_schedule.end_date IS NOT NULL AND p_new_next_due_date > v_schedule.end_date THEN
        RETURN QUERY SELECT
            FALSE,
            'Next due date exceeds schedule end date',
            ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- Calculate missed executions with input validation
    IF v_schedule.next_due_date IS NOT NULL
       AND v_schedule.interval_weeks IS NOT NULL
       AND v_schedule.interval_weeks > 0 THEN

        SELECT COUNT(*) INTO v_missed_count
        FROM generate_series(
            v_schedule.next_due_date,
            CURRENT_DATE,
            (v_schedule.interval_weeks || ' weeks')::interval
        ) AS missed_date
        WHERE missed_date < CURRENT_DATE;

        IF v_missed_count > 0 THEN
            v_warnings := array_append(v_warnings,
                format('%s executions were missed during pause', v_missed_count));
        END IF;
    END IF;

    -- Check if resuming far in the future
    IF p_new_next_due_date > CURRENT_DATE + INTERVAL '3 months' THEN
        v_warnings := array_append(v_warnings,
            'Resuming more than 3 months in the future');
    END IF;

    RETURN QUERY SELECT
        TRUE,
        NULL::TEXT,
        v_warnings;
END;
$$;

-- =====================================================
-- 5. Fix get_schedule_pause_statistics function - already has safe search_path
-- =====================================================
-- This function already has SET search_path = public, confirming it's secure

-- =====================================================
-- 6. Add security comments for documentation
-- =====================================================
COMMENT ON FUNCTION encrypt_text(text) IS
'SECURITY DEFINER function for encrypting text data. Uses SET search_path = public for security.';

COMMENT ON FUNCTION decrypt_text(bytea) IS
'SECURITY DEFINER function for decrypting text data. Uses SET search_path = public for security.';

COMMENT ON FUNCTION get_today_checklist(uuid) IS
'SECURITY DEFINER function for retrieving daily checklist. Uses SET search_path = public for security.';

COMMENT ON FUNCTION validate_schedule_resume(uuid, date) IS
'SECURITY DEFINER function for validating schedule resume. Uses SET search_path = public for security.';

COMMIT;