-- ============================================================================
-- Migration: Update RPC functions to use departments table instead of care_type
-- Created: 2025-11-09
-- Purpose: Fix RPC functions that reference removed care_type column
-- Phase: 2.1.4 - Code Migration (Application code and database functions)
-- ============================================================================

-- CRITICAL: This migration fixes RPC functions that broke after care_type column removal
-- These functions are essential for schedule filtering across the application

-- ============================================================================
-- STEP 1: Update get_filtered_schedules function
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_filtered_schedules"(
  "p_user_id" "uuid",
  "p_show_all" boolean DEFAULT false,
  "p_care_types" "text"[] DEFAULT NULL::"text"[],  -- Now expects department UUIDs, not care_type strings
  "p_date_start" "date" DEFAULT NULL::"date",
  "p_date_end" "date" DEFAULT NULL::"date"
) RETURNS TABLE(
  "schedule_id" "uuid",
  "patient_id" "uuid",
  "patient_name" "text",
  "patient_care_type" "text",  -- Returns department.name for backward compatibility
  "patient_number" "text",
  "doctor_id" "uuid",
  "doctor_name" "text",
  "item_id" "uuid",
  "item_name" "text",
  "item_category" "text",
  "next_due_date" "date",
  "interval_weeks" integer,
  "priority" integer,
  "status" "text",
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "notes" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_department_id UUID;
BEGIN
  -- Get user role and department_id from profiles
  SELECT role, department_id INTO v_user_role, v_user_department_id
  FROM profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    s.id as schedule_id,
    s.patient_id,
    p.name as patient_name,
    d.name as patient_care_type,  -- Use department.name instead of p.care_type
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
  LEFT JOIN departments d ON p.department_id = d.id  -- Join with departments table
  JOIN items i ON s.item_id = i.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  WHERE s.status IN ('active', 'paused')
  AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
  AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)  -- Use department_id
  )
  AND (
    p_care_types IS NULL
    OR p.department_id = ANY(p_care_types::uuid[])  -- Cast to UUID array
  )
  ORDER BY s.next_due_date, s.priority DESC;
END;
$$;

COMMENT ON FUNCTION "public"."get_filtered_schedules" IS
  'Updated to use departments table. p_care_types parameter now expects UUID array of department IDs.';

-- ============================================================================
-- STEP 2: Update get_calendar_schedules_filtered function
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_calendar_schedules_filtered"(
  "p_start_date" "date",
  "p_end_date" "date",
  "p_user_id" "uuid",
  "p_show_all" boolean DEFAULT false,
  "p_care_types" "text"[] DEFAULT NULL::"text"[]  -- Now expects department UUIDs
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
  "care_type" "text",  -- Returns department.name
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
    d.name as care_type,  -- Use department.name
    NULL::UUID as doctor_id_at_completion,
    NULL::TEXT as care_type_at_completion
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id  -- Join with departments
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
    OR p.department_id = ANY(p_care_types::uuid[])  -- Cast to UUID
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
    d.name as care_type,  -- Current department
    (e.metadata->>'doctor_id')::UUID as doctor_id_at_completion,
    dept_at_completion.name as care_type_at_completion  -- Department at completion
  FROM schedule_executions e
  JOIN schedules s ON e.schedule_id = s.id
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id  -- Current department
  LEFT JOIN departments dept_at_completion ON (e.metadata->>'department_id')::UUID = dept_at_completion.id  -- Department at time of execution
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
  'Updated to use departments table. Returns both scheduled and completed items with department information.';

-- ============================================================================
-- STEP 3: Update get_calendar_schedules function (if exists)
-- ============================================================================

-- This function may not be actively used, but update it for consistency
CREATE OR REPLACE FUNCTION "public"."get_calendar_schedules"(
  "p_start_date" "date",
  "p_end_date" "date",
  "p_user_id" "uuid" DEFAULT NULL::"uuid"
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
  "patient_number" "text",
  "care_type" "text",
  "doctor_id" "uuid",
  "doctor_name" "text",
  "item_name" "text",
  "item_category" "text",
  "interval_weeks" integer,
  "priority" integer
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Scheduled items
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
    p.patient_number,
    d.name as care_type,  -- Use department.name
    p.doctor_id,
    pr.name as doctor_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.priority
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id  -- Join with departments
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  JOIN items i ON s.item_id = i.id
  WHERE s.status = 'active'
  AND s.next_due_date >= p_start_date
  AND s.next_due_date <= p_end_date

  UNION ALL

  -- Completed items
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
    p.patient_number,
    d.name as care_type,
    p.doctor_id,
    pr.name as doctor_name,
    i.name as item_name,
    i.category as item_category,
    s.interval_weeks,
    s.priority
  FROM schedule_executions e
  JOIN schedules s ON e.schedule_id = s.id
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  JOIN items i ON s.item_id = i.id
  WHERE e.executed_date >= p_start_date
  AND e.executed_date <= p_end_date

  ORDER BY display_date, priority DESC;
END;
$$;

COMMENT ON FUNCTION "public"."get_calendar_schedules" IS
  'Updated to use departments table instead of care_type column.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the updated functions
DO $$
DECLARE
  v_test_user_id UUID;
  v_result_count INT;
BEGIN
  -- Get a test user ID (admin role preferred)
  SELECT id INTO v_test_user_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_test_user_id IS NOT NULL THEN
    -- Test get_filtered_schedules
    SELECT COUNT(*) INTO v_result_count
    FROM get_filtered_schedules(v_test_user_id, TRUE, NULL, NULL, NULL);

    RAISE NOTICE 'get_filtered_schedules test: % schedules returned', v_result_count;

    -- Test get_calendar_schedules_filtered
    SELECT COUNT(*) INTO v_result_count
    FROM get_calendar_schedules_filtered(CURRENT_DATE - 7, CURRENT_DATE + 7, v_test_user_id, TRUE, NULL);

    RAISE NOTICE 'get_calendar_schedules_filtered test: % items returned', v_result_count;
  ELSE
    RAISE NOTICE 'No admin user found for testing. Functions updated but not tested.';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION STATUS: Phase 2.1.4 COMPLETE
-- ============================================================================
-- ✅ All RPC functions updated to use departments table
-- ✅ Backward compatibility maintained (care_type fields still returned)
-- ✅ p_care_types parameter now accepts UUID arrays
--
-- Next Steps:
-- - Update application code to pass department UUIDs to p_care_types
-- - Remove any remaining care_type references in application code
-- - Test all filter combinations in the UI
-- ============================================================================
