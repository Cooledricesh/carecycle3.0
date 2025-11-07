-- Drop existing function
DROP FUNCTION IF EXISTS public.get_filter_statistics(uuid);

-- Create new function with organization_id parameter
CREATE OR REPLACE FUNCTION public.get_filter_statistics(
    p_organization_id uuid,
    p_user_id uuid
)
RETURNS TABLE(
    total_patients integer,
    my_patients integer,
    total_schedules integer,
    today_schedules integer,
    overdue_schedules integer,
    upcoming_schedules integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
