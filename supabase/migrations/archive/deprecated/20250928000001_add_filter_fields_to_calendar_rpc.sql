-- Migration: Add filter fields to get_calendar_schedules RPC function
-- Purpose: Include care_type, doctor_id, patient_number, and doctor_name for client-side filtering
-- Date: 2025-09-28

BEGIN;

-- Drop and recreate the function with additional fields
DROP FUNCTION IF EXISTS get_calendar_schedules(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION get_calendar_schedules(
    p_start_date DATE,
    p_end_date DATE,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    schedule_id UUID,
    patient_id UUID,
    item_id UUID,
    display_date DATE,
    display_type TEXT,
    schedule_status TEXT,
    execution_id UUID,
    executed_by UUID,
    execution_notes TEXT,
    patient_name TEXT,
    patient_number TEXT,
    care_type TEXT,
    doctor_id UUID,
    doctor_name TEXT,
    item_name TEXT,
    item_category TEXT,
    interval_weeks INTEGER,
    priority INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_calendar_schedules(DATE, DATE, UUID) TO authenticated;

-- Update documentation
COMMENT ON FUNCTION get_calendar_schedules IS
  'Retrieves both scheduled and completed schedule records for calendar display with filter fields (care_type, doctor_id, patient_number, doctor_name)';

COMMIT;