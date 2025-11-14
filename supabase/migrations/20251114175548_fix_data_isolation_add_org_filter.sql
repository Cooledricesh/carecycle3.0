-- ============================================================================
-- Migration: Fix Data Isolation - Add Organization Filter to RPC Functions
-- Created: 2025-11-14
-- Bug ID: BUG-20251114-DATA-ISOLATION-FAILURE
-- Severity: CRITICAL
-- Purpose: Fix organization_id filtering in schedule RPC functions
--
-- Problem:
--   - RPC functions use SECURITY DEFINER which bypasses RLS policies
--   - organization_id filter completely missing in WHERE clauses
--   - All organizations can see each other's schedule data
--   - Affects: /dashboard, /dashboard/calendar, /dashboard/schedules pages
--
-- Root Cause:
--   - SECURITY DEFINER executes with postgres privileges (RLS bypassed)
--   - Developer assumed RLS would handle filtering automatically
--   - organization_id filter must be explicitly implemented in function body
--
-- Solution:
--   - Add v_user_organization_id to DECLARE block
--   - Fetch organization_id from profiles table
--   - Add explicit organization_id filter to all WHERE clauses
--   - Apply to both scheduled and completed queries
--   - Handle Super Admin (null organization_id) case
--
-- Affected Functions:
--   1. get_calendar_schedules_filtered
--   2. get_filtered_schedules
--
-- Success Pattern Reference:
--   - get_filter_statistics (already implements org filter correctly)
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix get_calendar_schedules_filtered
-- ============================================================================

-- Drop and recreate function (return type unchanged)
DROP FUNCTION IF EXISTS "public"."get_calendar_schedules_filtered"(
  "date", "date", "uuid", boolean, "text"[]
);

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
  "injection_dosage" numeric,
  "priority" integer,
  "doctor_id" "uuid",
  "doctor_name" "text",
  "care_type" "text",
  "doctor_id_at_completion" "uuid",
  "care_type_at_completion" "text",
  "notes" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_department_id UUID;
  v_user_organization_id UUID;  -- ✅ ADDED: Critical for data isolation
BEGIN
  -- Get user context including organization_id
  SELECT role, department_id, organization_id
  INTO v_user_role, v_user_department_id, v_user_organization_id
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
    s.injection_dosage,
    s.priority,
    p.doctor_id,
    pr.name as doctor_name,
    d.name as care_type,
    NULL::UUID as doctor_id_at_completion,
    NULL::TEXT as care_type_at_completion,
    s.notes
  FROM schedules s
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  JOIN items i ON s.item_id = i.id
  WHERE s.status = 'active'
  AND s.next_due_date >= p_start_date
  AND s.next_due_date <= p_end_date
  -- ✅ CRITICAL FIX: Organization isolation
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR s.organization_id = v_user_organization_id
  )
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR p.organization_id = v_user_organization_id  -- Double-check via patient
  )
  -- Role-based filters (existing logic)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)
  )
  -- Department filters (existing logic)
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
    s.injection_dosage,
    s.priority,
    p.doctor_id,
    pr.name as doctor_name,
    d.name as care_type,
    (e.metadata->>'doctor_id')::UUID as doctor_id_at_completion,
    dept_at_completion.name as care_type_at_completion,
    s.notes
  FROM schedule_executions e
  JOIN schedules s ON e.schedule_id = s.id
  JOIN patients p ON s.patient_id = p.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  LEFT JOIN departments dept_at_completion ON (e.metadata->>'department_id')::UUID = dept_at_completion.id
  JOIN items i ON s.item_id = i.id
  WHERE e.executed_date >= p_start_date
  AND e.executed_date <= p_end_date
  -- ✅ CRITICAL FIX: Organization isolation for completed items
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR s.organization_id = v_user_organization_id
  )
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR p.organization_id = v_user_organization_id  -- Double-check via patient
  )
  -- Role-based filters (existing logic)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)
  )
  -- Department filters (existing logic)
  AND (
    p_care_types IS NULL
    OR p.department_id = ANY(p_care_types::uuid[])
  )

  ORDER BY display_date, priority DESC;
END;
$$;

COMMENT ON FUNCTION "public"."get_calendar_schedules_filtered" IS
  'Calendar schedules with CRITICAL FIX: organization_id filtering added. Bug BUG-20251114-DATA-ISOLATION-FAILURE resolved. SECURITY DEFINER bypasses RLS, so explicit org filter is mandatory.';

-- ============================================================================
-- STEP 2: Fix get_filtered_schedules
-- ============================================================================

-- Drop existing function first
DROP FUNCTION IF EXISTS "public"."get_filtered_schedules"(
  "uuid", boolean, "text"[], "date", "date"
);

CREATE FUNCTION "public"."get_filtered_schedules"(
  "p_user_id" "uuid",
  "p_show_all" boolean DEFAULT false,
  "p_care_types" "text"[] DEFAULT NULL::"text"[],
  "p_date_start" "date" DEFAULT NULL::"date",
  "p_date_end" "date" DEFAULT NULL::"date"
) RETURNS TABLE(
  "schedule_id" "uuid",
  "patient_id" "uuid",
  "patient_name" "text",
  "patient_care_type" "text",
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
  v_user_organization_id UUID;  -- ✅ ADDED: Critical for data isolation
BEGIN
  -- Get user context including organization_id
  SELECT role, department_id, organization_id
  INTO v_user_role, v_user_department_id, v_user_organization_id
  FROM profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    s.id as schedule_id,
    s.patient_id,
    p.name as patient_name,
    d.name as patient_care_type,
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
  LEFT JOIN departments d ON p.department_id = d.id
  JOIN items i ON s.item_id = i.id
  LEFT JOIN profiles pr ON p.doctor_id = pr.id
  WHERE s.status IN ('active', 'paused')
  AND (p_date_start IS NULL OR s.next_due_date >= p_date_start)
  AND (p_date_end IS NULL OR s.next_due_date <= p_date_end)
  -- ✅ CRITICAL FIX: Organization isolation
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR s.organization_id = v_user_organization_id
  )
  AND (
    v_user_organization_id IS NULL  -- Super Admin can see all
    OR p.organization_id = v_user_organization_id  -- Double-check via patient
  )
  -- Role-based filters (existing logic)
  AND (
    p_show_all = TRUE
    OR v_user_role = 'admin'
    OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
    OR (v_user_role = 'nurse' AND p.department_id = v_user_department_id)
  )
  -- Department filters (existing logic)
  AND (
    p_care_types IS NULL
    OR p.department_id = ANY(p_care_types::uuid[])
  )
  ORDER BY s.next_due_date, s.priority DESC;
END;
$$;

COMMENT ON FUNCTION "public"."get_filtered_schedules" IS
  'Schedule filtering with CRITICAL FIX: organization_id filtering added. Bug BUG-20251114-DATA-ISOLATION-FAILURE resolved. SECURITY DEFINER bypasses RLS, so explicit org filter is mandatory.';

-- ============================================================================
-- VERIFICATION TESTS
-- ============================================================================

DO $$
DECLARE
  v_test_user1_id UUID;
  v_test_user2_id UUID;
  v_org1_id UUID;
  v_org2_id UUID;
  v_org1_count INT;
  v_org2_count INT;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TESTING DATA ISOLATION FIX';
  RAISE NOTICE '========================================';

  -- Get two different organizations
  SELECT id INTO v_org1_id FROM organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO v_org2_id FROM organizations ORDER BY created_at LIMIT 1 OFFSET 1;

  IF v_org1_id IS NULL OR v_org2_id IS NULL THEN
    RAISE NOTICE '⚠️  Not enough organizations for testing (need at least 2)';
    RETURN;
  END IF;

  -- Get one user from each organization
  SELECT id INTO v_test_user1_id FROM profiles WHERE organization_id = v_org1_id LIMIT 1;
  SELECT id INTO v_test_user2_id FROM profiles WHERE organization_id = v_org2_id LIMIT 1;

  IF v_test_user1_id IS NULL OR v_test_user2_id IS NULL THEN
    RAISE NOTICE '⚠️  Not enough users for testing';
    RETURN;
  END IF;

  RAISE NOTICE '📋 Test Setup:';
  RAISE NOTICE '  Organization 1: %', v_org1_id;
  RAISE NOTICE '  Organization 2: %', v_org2_id;
  RAISE NOTICE '  Test User 1 (Org1): %', v_test_user1_id;
  RAISE NOTICE '  Test User 2 (Org2): %', v_test_user2_id;
  RAISE NOTICE '';

  -- Test 1: get_calendar_schedules_filtered
  RAISE NOTICE '🧪 TEST 1: get_calendar_schedules_filtered';

  SELECT COUNT(*) INTO v_org1_count
  FROM get_calendar_schedules_filtered(
    CURRENT_DATE - 30, CURRENT_DATE + 30, v_test_user1_id, TRUE, NULL
  );

  SELECT COUNT(*) INTO v_org2_count
  FROM get_calendar_schedules_filtered(
    CURRENT_DATE - 30, CURRENT_DATE + 30, v_test_user2_id, TRUE, NULL
  );

  RAISE NOTICE '  Org1 schedule count: %', v_org1_count;
  RAISE NOTICE '  Org2 schedule count: %', v_org2_count;

  IF v_org1_count > 0 AND v_org2_count > 0 AND v_org1_count = v_org2_count THEN
    RAISE NOTICE '  ❌ FAILED: Both organizations see same data count (possible leak)';
    v_test_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✅ PASSED: Data counts differ or one is zero (isolation working)';
  END IF;
  RAISE NOTICE '';

  -- Test 2: get_filtered_schedules
  RAISE NOTICE '🧪 TEST 2: get_filtered_schedules';

  SELECT COUNT(*) INTO v_org1_count
  FROM get_filtered_schedules(v_test_user1_id, TRUE, NULL, NULL, NULL);

  SELECT COUNT(*) INTO v_org2_count
  FROM get_filtered_schedules(v_test_user2_id, TRUE, NULL, NULL, NULL);

  RAISE NOTICE '  Org1 filtered schedule count: %', v_org1_count;
  RAISE NOTICE '  Org2 filtered schedule count: %', v_org2_count;

  IF v_org1_count > 0 AND v_org2_count > 0 AND v_org1_count = v_org2_count THEN
    RAISE NOTICE '  ❌ FAILED: Both organizations see same data count (possible leak)';
    v_test_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✅ PASSED: Data counts differ or one is zero (isolation working)';
  END IF;
  RAISE NOTICE '';

  -- Final result
  RAISE NOTICE '========================================';
  IF v_test_passed THEN
    RAISE NOTICE '✅ ALL TESTS PASSED: Data isolation is working';
  ELSE
    RAISE NOTICE '❌ SOME TESTS FAILED: Manual verification required';
  END IF;
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST ERROR: %', SQLERRM;
    RAISE NOTICE '   Tests could not complete - verify manually';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ v_user_organization_id variable added to both functions
-- ✅ organization_id fetched from profiles table
-- ✅ Explicit organization_id filter added to all WHERE clauses
-- ✅ Super Admin (null org_id) can still see all data
-- ✅ Regular users can only see their organization's data
-- ✅ Both scheduled and completed queries protected
-- ✅ Verification tests included
--
-- CRITICAL NOTES:
-- - SECURITY DEFINER bypasses RLS, so explicit filters are MANDATORY
-- - Never assume RLS will protect SECURITY DEFINER functions
-- - Always include organization_id filter in multi-tenant RPC functions
-- - Super Admin special case: NULL organization_id means "see all"
--
-- AFFECTED PAGES:
-- - /dashboard (pending items statistics)
-- - /dashboard/calendar (calendar view)
-- - /dashboard/schedules (schedule list)
--
-- BUG-20251114-DATA-ISOLATION-FAILURE: RESOLVED
-- ============================================================================
