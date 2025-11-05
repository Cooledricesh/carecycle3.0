-- Migration: Add urgency filter parameter to get_filtered_schedules
-- Date: 2025-09-23
-- Purpose: Support urgency level filtering in RPC function for cache consistency

BEGIN;

-- ============================================
-- Drop and recreate get_filtered_schedules with urgency parameter
-- ============================================

DROP FUNCTION IF EXISTS get_filtered_schedules(UUID, BOOLEAN, TEXT[], DATE, DATE);

CREATE OR REPLACE FUNCTION get_filtered_schedules(
    p_user_id UUID,
    p_show_all BOOLEAN DEFAULT FALSE,
    p_care_types TEXT[] DEFAULT NULL,
    p_date_start DATE DEFAULT NULL,
    p_date_end DATE DEFAULT NULL,
    p_urgency_level TEXT DEFAULT NULL  -- New parameter: 'urgent', 'normal', or NULL for all
)
RETURNS TABLE (
    schedule_id UUID,
    patient_id UUID,
    patient_name TEXT,
    patient_care_type TEXT,
    patient_number TEXT,
    doctor_id UUID,
    doctor_name TEXT,
    item_id UUID,
    item_name TEXT,
    item_category TEXT,
    next_due_date DATE,
    status TEXT,
    interval_weeks INTEGER,
    priority INTEGER,  -- Added priority field
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    notes TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_role TEXT;
    v_user_care_type TEXT;
BEGIN
    -- Get user role and care_type from profiles
    SELECT role, care_type INTO v_user_role, v_user_care_type
    FROM profiles
    WHERE id = p_user_id;

    -- Return empty set if user not found
    IF v_user_role IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.id AS schedule_id,
        p.id AS patient_id,
        p.name AS patient_name,
        p.care_type AS patient_care_type,
        p.patient_number AS patient_number,
        p.doctor_id AS doctor_id,
        COALESCE(doc.name, '') AS doctor_name,
        i.id AS item_id,
        i.name AS item_name,
        i.category AS item_category,
        s.next_due_date AS next_due_date,
        s.status AS status,
        s.interval_weeks AS interval_weeks,
        s.priority AS priority,
        s.created_at AS created_at,
        s.updated_at AS updated_at,
        s.notes AS notes
    FROM schedules s
    INNER JOIN patients p ON s.patient_id = p.id
    INNER JOIN items i ON s.item_id = i.id
    LEFT JOIN profiles doc ON p.doctor_id = doc.id
    WHERE
        s.status = 'active'
        -- Role-based filtering
        AND CASE
            WHEN v_user_role = 'admin' THEN TRUE
            WHEN v_user_role = 'nurse' THEN
                (p_show_all = TRUE OR p.care_type = v_user_care_type)
            WHEN v_user_role = 'doctor' THEN
                (p_show_all = TRUE OR p.doctor_id = p_user_id)
            ELSE FALSE
        END
        -- Care type filtering (if specified)
        AND (p_care_types IS NULL OR p.care_type = ANY(p_care_types))
        -- Date range filtering (if specified)
        AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
        AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)
        -- Urgency level filtering (if specified)
        AND (
            p_urgency_level IS NULL
            OR (p_urgency_level = 'urgent' AND s.priority >= 7)
            OR (p_urgency_level = 'normal' AND s.priority < 7)
        )
    ORDER BY s.next_due_date ASC, p.name ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_filtered_schedules TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_filtered_schedules IS 'Returns filtered schedules based on user role, care types, date range, and urgency level. Urgency levels: urgent (priority >= 7), normal (priority < 7)';

COMMIT;