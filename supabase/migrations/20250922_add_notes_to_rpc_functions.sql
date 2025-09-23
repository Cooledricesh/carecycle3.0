-- Migration: Add notes field to RPC functions
-- Date: 2025-09-22
-- Purpose: Include notes field in get_filtered_schedules function to display memo in calendar cards

BEGIN;

-- ============================================
-- Drop and recreate get_filtered_schedules with notes field
-- ============================================

DROP FUNCTION IF EXISTS get_filtered_schedules(UUID, BOOLEAN, TEXT[], DATE, DATE);

CREATE OR REPLACE FUNCTION get_filtered_schedules(
    p_user_id UUID,
    p_show_all BOOLEAN DEFAULT FALSE,
    p_care_types TEXT[] DEFAULT NULL,
    p_date_start DATE DEFAULT NULL,
    p_date_end DATE DEFAULT NULL
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
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    notes TEXT  -- Added notes field
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

    -- If user not found, return empty result
    IF v_user_role IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.id AS schedule_id,
        s.patient_id,
        p.name AS patient_name,
        p.care_type AS patient_care_type,
        p.patient_number AS patient_number,
        p.doctor_id,
        COALESCE(doc.name, '미지정') AS doctor_name,
        s.item_id,
        i.name AS item_name,
        i.category AS item_category,
        s.next_due_date,
        s.status::TEXT,
        s.interval_weeks,
        s.created_at,
        s.updated_at,
        s.notes  -- Added notes to SELECT
    FROM schedules s
    INNER JOIN patients p ON s.patient_id = p.id
    INNER JOIN items i ON s.item_id = i.id
    LEFT JOIN profiles doc ON p.doctor_id = doc.id
    WHERE
        -- Status filter (only active and paused schedules)
        s.status IN ('active', 'paused')

        -- Date range filter
        AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
        AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)

        -- Care type filter
        AND (p_care_types IS NULL OR p.care_type = ANY(p_care_types))

        -- Role-based access control
        AND (
            -- Admin sees everything
            v_user_role = 'admin'

            -- Show all flag bypasses role restrictions
            OR p_show_all = TRUE

            -- Doctor sees only assigned patients when not showing all
            OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)

            -- Nurse sees only department patients when not showing all
            OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type)
        )
    ORDER BY
        -- Prioritize today's schedules
        CASE WHEN s.next_due_date = CURRENT_DATE THEN 0 ELSE 1 END,
        s.next_due_date ASC,
        p.name ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_filtered_schedules TO authenticated;

-- ============================================
-- Also update the materialized view to include notes
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS dashboard_schedule_summary CASCADE;

CREATE MATERIALIZED VIEW dashboard_schedule_summary AS
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
    s.notes,  -- Added notes field
    -- Computed fields for quick filtering
    CASE
        WHEN s.next_due_date < CURRENT_DATE THEN 'overdue'
        WHEN s.next_due_date = CURRENT_DATE THEN 'due_today'
        WHEN s.next_due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'upcoming'
        ELSE 'future'
    END AS urgency_level
FROM schedules s
INNER JOIN patients p ON s.patient_id = p.id
INNER JOIN items i ON s.item_id = i.id
LEFT JOIN profiles doc ON p.doctor_id = doc.id
WHERE s.status IN ('active', 'paused')
WITH DATA;

-- Recreate indexes on materialized view
CREATE INDEX idx_dashboard_summary_doctor
    ON dashboard_schedule_summary(doctor_id, next_due_date);
CREATE INDEX idx_dashboard_summary_care_type
    ON dashboard_schedule_summary(care_type, next_due_date);
CREATE INDEX idx_dashboard_summary_urgency
    ON dashboard_schedule_summary(urgency_level, next_due_date);

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Successfully added notes field to get_filtered_schedules function';
    RAISE NOTICE 'Successfully updated dashboard_schedule_summary materialized view with notes field';
END $$;

COMMIT;