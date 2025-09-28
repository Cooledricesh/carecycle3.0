-- Fix: Drop and recreate get_filtered_schedules function with correct return type

BEGIN;

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_filtered_schedules(UUID, BOOLEAN, TEXT[], DATE, DATE);

-- Recreate with the correct signature
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

COMMIT;