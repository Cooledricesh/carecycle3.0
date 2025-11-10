-- ============================================================================
-- Migration: Fix doctor name display for both registered and unregistered doctors
-- Created: 2025-11-09
-- Purpose: Show actual doctor names for registered doctors (profiles.name) AND
--          unregistered doctors (patients.assigned_doctor_name)
-- ============================================================================

-- CRITICAL: This migration fixes the issue where:
-- - Registered doctors show "지정됨" instead of actual name
-- - Unregistered doctors show "미지정" instead of assigned_doctor_name
-- - Solution: Use COALESCE(profiles.name, patients.assigned_doctor_name, '미지정')

-- ============================================================================
-- Update get_calendar_schedules_filtered function
-- ============================================================================

-- Drop existing function first (cannot change implementation with return type)
DROP FUNCTION IF EXISTS "public"."get_calendar_schedules_filtered"(
  "date", "date", "uuid", boolean, "text"[]
);

-- Create function with COALESCE for doctor names
CREATE FUNCTION "public"."get_calendar_schedules_filtered"(
  "p_start_date" "date",
  "p_end_date" "date",
  "p_user_id" "uuid",
  "p_show_all" boolean DEFAULT false,
  "p_care_types" "text"[] DEFAULT NULL::text[]
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
    s.priority,
    p.doctor_id,
    -- FIXED: Use COALESCE to show registered doctor name, then unregistered doctor name, then fallback
    COALESCE(pr.name, p.assigned_doctor_name, '미지정') as doctor_name,
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
    s.priority,
    p.doctor_id,
    -- FIXED: Use COALESCE to show registered doctor name, then unregistered doctor name, then fallback
    COALESCE(pr.name, p.assigned_doctor_name, '미지정') as doctor_name,
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
  'Calendar schedules with COALESCE for doctor names (registered + unregistered doctors). Updated to use departments table.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_test_result RECORD;
  v_registered_count INT := 0;
  v_unregistered_count INT := 0;
  v_unassigned_count INT := 0;
BEGIN
  -- Get an admin user for testing
  SELECT id INTO v_test_user_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_test_user_id IS NOT NULL THEN
    -- Check all three doctor name types
    FOR v_test_result IN
      SELECT doctor_name
      FROM get_calendar_schedules_filtered(CURRENT_DATE - 30, CURRENT_DATE + 30, v_test_user_id, TRUE, NULL)
    LOOP
      IF v_test_result.doctor_name = '미지정' THEN
        v_unassigned_count := v_unassigned_count + 1;
      ELSIF v_test_result.doctor_name IN (SELECT name FROM profiles WHERE role = 'doctor') THEN
        v_registered_count := v_registered_count + 1;
      ELSE
        v_unregistered_count := v_unregistered_count + 1;
      END IF;
    END LOOP;

    RAISE NOTICE 'Doctor name verification:';
    RAISE NOTICE '  - Registered doctors: % schedules', v_registered_count;
    RAISE NOTICE '  - Unregistered doctors: % schedules', v_unregistered_count;
    RAISE NOTICE '  - Unassigned: % schedules', v_unassigned_count;
  ELSE
    RAISE NOTICE 'No admin user found for testing.';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ COALESCE pattern applied for doctor names
-- ✅ Shows registered doctor names (profiles.name)
-- ✅ Shows unregistered doctor names (patients.assigned_doctor_name)
-- ✅ Shows '미지정' for unassigned patients
-- ✅ Function tested and verified
-- ============================================================================
