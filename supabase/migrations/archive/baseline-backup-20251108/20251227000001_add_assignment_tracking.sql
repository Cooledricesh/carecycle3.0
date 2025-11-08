-- Migration: Add doctor and care_type tracking at completion time
-- Purpose: Track who was assigned when schedule was completed for accurate historical records

BEGIN;

-- 1. Add tracking columns to schedule_executions table
ALTER TABLE schedule_executions
ADD COLUMN IF NOT EXISTS doctor_id_at_completion UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS care_type_at_completion TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_executions_doctor_completion
ON schedule_executions(doctor_id_at_completion, executed_date)
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_schedule_executions_care_type_completion
ON schedule_executions(care_type_at_completion, executed_date)
WHERE status = 'completed';

-- 2. Create improved RPC function for calendar schedules with proper filtering
CREATE OR REPLACE FUNCTION get_calendar_schedules_filtered(
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID,
  p_show_all BOOLEAN DEFAULT FALSE,
  p_care_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
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
  item_name TEXT,
  item_category TEXT,
  interval_weeks INTEGER,
  priority INTEGER,
  doctor_id UUID,
  care_type TEXT,
  doctor_id_at_completion UUID,
  care_type_at_completion TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    p.doctor_id as doctor_id,  -- Current assignment
    p.care_type as care_type,  -- Current care_type
    se.doctor_id_at_completion,  -- Historical assignment
    se.care_type_at_completion   -- Historical care_type
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

-- 3. Create trigger to automatically capture doctor/care_type at completion
CREATE OR REPLACE FUNCTION capture_assignment_at_completion()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS capture_assignment_before_completion ON schedule_executions;
CREATE TRIGGER capture_assignment_before_completion
  BEFORE INSERT OR UPDATE ON schedule_executions
  FOR EACH ROW
  EXECUTE FUNCTION capture_assignment_at_completion();

-- 4. Backfill existing completed executions with current assignments
-- This preserves history as best as possible with current data
UPDATE schedule_executions se
SET
  doctor_id_at_completion = p.doctor_id,
  care_type_at_completion = p.care_type
FROM schedules s
JOIN patients p ON s.patient_id = p.id
WHERE se.schedule_id = s.id
  AND se.status = 'completed'
  AND se.doctor_id_at_completion IS NULL;

-- 5. Create helper function for getting filtered schedules (for backward compatibility)
CREATE OR REPLACE FUNCTION get_filtered_schedules(
  p_user_id UUID,
  p_show_all BOOLEAN DEFAULT FALSE,
  p_care_types TEXT[] DEFAULT NULL,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL
)
RETURNS TABLE(
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
  interval_weeks INTEGER,
  priority INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  WHERE s.status = 'active'
  -- Date range filter
  AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
  AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)
  -- Role-based filtering
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type)
  )
  -- Care type filter
  AND (p_care_types IS NULL OR p.care_type = ANY(p_care_types))
  ORDER BY s.next_due_date, s.priority DESC;
END;
$$;

-- 6. Add comment for documentation
COMMENT ON COLUMN schedule_executions.doctor_id_at_completion IS
  'Doctor assigned to patient when schedule was completed. Preserved for historical accuracy even if patient is later reassigned.';

COMMENT ON COLUMN schedule_executions.care_type_at_completion IS
  'Care type of patient when schedule was completed. Preserved for historical accuracy even if patient care type changes.';

COMMIT;