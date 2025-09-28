-- Alternative Solution: Function-based patient update to bypass RLS complexity
-- This migration provides a secure function that handles patient updates
-- with proper role-based access control, avoiding RLS policy conflicts

BEGIN;

-- ========================================
-- Create a secure function for updating patients
-- ========================================

CREATE OR REPLACE FUNCTION public.update_patient_with_role_check(
    p_patient_id UUID,
    p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_user_care_type TEXT;
    v_is_active BOOLEAN;
    v_approval_status TEXT;
    v_patient_care_type TEXT;
    v_patient_doctor_id UUID;
    v_result JSONB;
    v_update_sql TEXT;
    v_allowed_fields TEXT[];
BEGIN
    -- Get current user information
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get user profile information
    SELECT role, care_type, is_active, approval_status
    INTO v_user_role, v_user_care_type, v_is_active, v_approval_status
    FROM profiles
    WHERE id = v_user_id;

    -- Check if user is active and approved
    IF NOT v_is_active OR v_approval_status != 'approved' THEN
        RAISE EXCEPTION 'User is not active or approved';
    END IF;

    -- Get current patient information for validation
    SELECT care_type, doctor_id
    INTO v_patient_care_type, v_patient_doctor_id
    FROM patients
    WHERE id = p_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    -- Define allowed fields based on role
    CASE v_user_role
        WHEN 'admin' THEN
            -- Admin can update all fields
            v_allowed_fields := ARRAY['name', 'patient_number', 'care_type', 'doctor_id', 'is_active', 'metadata'];

        WHEN 'nurse' THEN
            -- Nurse can update all fields including doctor_id
            v_allowed_fields := ARRAY['name', 'patient_number', 'care_type', 'doctor_id', 'is_active', 'metadata'];

        WHEN 'doctor' THEN
            -- Doctor can update all fields including doctor_id (can reassign patients)
            v_allowed_fields := ARRAY['name', 'patient_number', 'care_type', 'doctor_id', 'is_active', 'metadata'];

        ELSE
            RAISE EXCEPTION 'Invalid user role: %', v_user_role;
    END CASE;

    -- Build dynamic UPDATE statement with only allowed fields
    v_update_sql := 'UPDATE patients SET updated_at = NOW()';

    -- Add each allowed field if present in updates
    FOR i IN 1..array_length(v_allowed_fields, 1) LOOP
        IF p_updates ? v_allowed_fields[i] THEN
            v_update_sql := v_update_sql || ', ' ||
                quote_ident(v_allowed_fields[i]) || ' = ' ||
                quote_literal(p_updates ->> v_allowed_fields[i]);
        END IF;
    END LOOP;

    v_update_sql := v_update_sql || ' WHERE id = ' || quote_literal(p_patient_id) ||
                    ' RETURNING to_jsonb(patients.*) as result';

    -- Execute the update
    EXECUTE v_update_sql INTO v_result;

    -- Log the update for auditing
    INSERT INTO audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_role,
        timestamp
    ) VALUES (
        'patients',
        'UPDATE',
        p_patient_id,
        jsonb_build_object('doctor_id', v_patient_doctor_id, 'care_type', v_patient_care_type),
        p_updates,
        v_user_id,
        v_user_role,
        NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE WARNING 'Patient update failed for user % (role: %): %', v_user_id, v_user_role, SQLERRM;
        RAISE;
END;
$$;

-- ========================================
-- Create a simpler function specifically for doctor_id updates
-- ========================================

CREATE OR REPLACE FUNCTION public.update_patient_doctor_assignment(
    p_patient_id UUID,
    p_new_doctor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_is_authorized BOOLEAN;
    v_result JSONB;
BEGIN
    -- Get current user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check user authorization
    SELECT
        role,
        (role IN ('admin', 'nurse', 'doctor') AND is_active = true AND approval_status = 'approved')
    INTO v_user_role, v_is_authorized
    FROM profiles
    WHERE id = v_user_id;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized to update patient assignments';
    END IF;

    -- Verify the new doctor exists and is a doctor
    IF p_new_doctor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE id = p_new_doctor_id
            AND role = 'doctor'
            AND is_active = true
            AND approval_status = 'approved'
        ) THEN
            RAISE EXCEPTION 'Invalid doctor ID or doctor is not active';
        END IF;
    END IF;

    -- Update the patient
    UPDATE patients
    SET
        doctor_id = p_new_doctor_id,
        updated_at = NOW()
    WHERE id = p_patient_id
    RETURNING to_jsonb(patients.*) INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Patient not found or update failed';
    END IF;

    RETURN v_result;
END;
$$;

-- ========================================
-- Grant execute permissions
-- ========================================

GRANT EXECUTE ON FUNCTION public.update_patient_with_role_check(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_patient_doctor_assignment(UUID, UUID) TO authenticated;

-- ========================================
-- Add comments for documentation
-- ========================================

COMMENT ON FUNCTION public.update_patient_with_role_check IS
'Secure function to update patient records with role-based access control. Bypasses RLS to avoid policy conflicts.';

COMMENT ON FUNCTION public.update_patient_doctor_assignment IS
'Specialized function to update patient doctor assignments. Available to admin, nurse, and doctor roles.';

COMMIT;

-- ========================================
-- Usage examples:
-- ========================================

-- Update doctor assignment:
-- SELECT update_patient_doctor_assignment('patient-uuid', 'doctor-uuid');

-- Update multiple fields:
-- SELECT update_patient_with_role_check(
--     'patient-uuid',
--     '{"name": "John Doe", "doctor_id": "doctor-uuid", "care_type": "외래"}'::jsonb
-- );