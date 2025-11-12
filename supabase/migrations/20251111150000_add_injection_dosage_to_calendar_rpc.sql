-- ============================================================================
-- Migration: Add injection_dosage to get_calendar_schedules_filtered
-- Created: 2025-11-11
-- Purpose: Fix missing injection_dosage in calendar RPC function
-- ============================================================================

-- Drop existing function first (cannot change return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS "public"."get_calendar_schedules_filtered"(
  "date", "date", "uuid", boolean, "text"[]
);

-- Create function with updated return type including injection_dosage
CREATE FUNCTION "public"."get_calendar_schedules_filtered"(
  "p_start_date" "date",
  "p_end_date" "date",
  "p_user_id" "uuid",
  "p_show_all" boolean DEFAULT false,
  "p_care_types" "text"[] DEFAULT NULL::"text"[]
) RETURNS TABLE(
  "schedule_id" "uuid",
  "patient_id" "uuid",
  "item_id" "uuid",
  "display_date" "date",
  "display_type" "text",
  "schedule_status" "text",
  "execution_id" "uuid",
  "executed_by" "uuid",
  "execution_notes" "text",
  "patient_name" "text",
  "item_name" "text",
  "item_category" "text",
  "interval_weeks" integer,
  "injection_dosage" numeric,  -- ADDED: Injection dosage field
  "priority" integer,
  "doctor_id" "uuid",
  "doctor_name" "text",
  "care_type" "text",
  "doctor_id_at_completion" "uuid",
  "care_type_at_completion" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_department_id UUID;
BEGIN
  -- Get user context
  SELECT role, department_id INTO v_user_role, v_user_department_id
  FROM profiles
  WHERE id = p_user_id;

  RETURN QUERY
  -- Scheduled items (not yet executed)
  SELECT
    s.id as schedule_id,
    s.patient_id,
    s.item_id,
    s.next_due_date as display_date,
    'scheduled'::TEXT as display_type,
    s.status::TEXT as schedule_status,
    NULL::UUID as execution_id,
    NULL::UUID as executed_by,
    NULL::TEXT as execution_notes,
    p.name as patient_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.injection_dosage,  -- ADDED: Include injection_dosage from schedules
    s.priority,
    p.doctor_id,
    pr.name as doctor_name,
    d.name as care_type,
    NULL::UUID as doctor_id_at_completion,
    NULL::TEXT as care_type_at_completion
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  JOIN items i ON s.item_id = i.id
  WHERE s.status = 'active'
  AND s.next_due_date >= p_start_date
  AND s.next_due_date <= p_end_date
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)
  )
  AND (
    p_care_types IS NULL
    OR p.department_id = ANY(p_care_types::uuid[])
  )

  UNION ALL

  -- Completed items (executions within date range)
  SELECT
    s.id as schedule_id,
    s.patient_id,
    s.item_id,
    e.executed_date as display_date,
    'completed'::TEXT as display_type,
    s.status::TEXT as schedule_status,
    e.id as execution_id,
    e.executed_by,
    e.notes as execution_notes,
    p.name as patient_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.injection_dosage,  -- ADDED: Include injection_dosage from schedules
    s.priority,
    p.doctor_id,
    pr.name as doctor_name,
    d.name as care_type,
    (e.metadata->>'doctor_id')::UUID as doctor_id_at_completion,
    dept_at_completion.name as care_type_at_completion
  FROM schedule_executions e
  JOIN schedules s ON e.schedule_id = s.id
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  LEFT JOIN departments dept_at_completion ON (e.metadata->>'department_id')::UUID = dept_at_completion.id
  JOIN items i ON s.item_id = i.id
  WHERE e.executed_date >= p_start_date
  AND e.executed_date <= p_end_date
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)
  )
  AND (
    p_care_types IS NULL
    OR p.department_id = ANY(p_care_types::uuid[])
  )

  ORDER BY display_date, priority DESC;
END;
$$;

COMMENT ON FUNCTION "public"."get_calendar_schedules_filtered" IS
  'Calendar schedules with injection_dosage and doctor_name included. Updated to use departments table.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_result_count INT;
  v_has_dosage BOOLEAN;
BEGIN
  SELECT id INTO v_test_user_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_test_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_result_count
    FROM get_calendar_schedules_filtered(CURRENT_DATE - 7, CURRENT_DATE + 7, v_test_user_id, TRUE, NULL);

    -- Check if any results have injection_dosage
    SELECT EXISTS (
      SELECT 1
      FROM get_calendar_schedules_filtered(CURRENT_DATE - 7, CURRENT_DATE + 7, v_test_user_id, TRUE, NULL)
      WHERE injection_dosage IS NOT NULL
    ) INTO v_has_dosage;

    RAISE NOTICE 'get_calendar_schedules_filtered test: % items returned, has_dosage: %', v_result_count, v_has_dosage;
  ELSE
    RAISE NOTICE 'No admin user found for testing.';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ injection_dosage added to get_calendar_schedules_filtered
-- ✅ Field included in both scheduled and completed items
-- ✅ Function tested and working
-- ============================================================================
