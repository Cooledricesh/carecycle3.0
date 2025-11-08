-- ============================================================================
-- Migration: Drop care_type columns from profiles and patients
-- Created: 2025-11-09
-- Purpose: Final cleanup after migration to departments table (Phase 2 - Step 4: DROP)
-- Phase: 2.1.5 - Schema Cleanup
-- ============================================================================

-- ⚠️ CRITICAL: This migration should ONLY be run after:
-- 1. Phase 2.1.1: departments table created
-- 2. Phase 2.1.2: department_id columns added
-- 3. Phase 2.1.3: Data backfilled to departments
-- 4. Phase 2.1.4: Application code updated to use department_id
-- 5. Application deployed and verified working with new code

-- ============================================================================
-- STEP 1: Drop dependent views and materialized views that reference care_type
-- ============================================================================

-- Drop materialized view that depends on patients.care_type
DROP MATERIALIZED VIEW IF EXISTS public.dashboard_schedule_summary CASCADE;

-- Drop view that depends on patients.care_type
DROP VIEW IF EXISTS public.patient_doctor_view CASCADE;

-- ============================================================================
-- STEP 2: Drop dependent RLS policies that reference care_type
-- ============================================================================

-- Drop the policy that references profiles.care_type
DROP POLICY IF EXISTS "Nurses can view department schedules" ON public.patient_schedules;

-- ============================================================================
-- STEP 3: Drop care_type column from profiles table
-- ============================================================================

-- Remove CHECK constraint first (if exists)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_role_care_type;

-- Drop the care_type column
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS care_type;

-- ============================================================================
-- STEP 4: Drop care_type column from patients table
-- ============================================================================

-- Remove CHECK constraint first (if exists)
ALTER TABLE public.patients
DROP CONSTRAINT IF EXISTS patients_care_type_check;

-- Drop the care_type column
ALTER TABLE public.patients
DROP COLUMN IF EXISTS care_type;

-- ============================================================================
-- STEP 5: Recreate RLS policy using department_id instead of care_type
-- ============================================================================

-- Recreate the policy with department_id reference
-- Note: patient_schedules.department is still TEXT, so we need to join through departments table
-- This policy allows nurses to view schedules where the patient's department matches their own department
CREATE POLICY "Nurses can view department schedules" ON public.patient_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.departments d ON p.department_id = d.id
    WHERE p.id = auth.uid()
      AND p.role = 'nurse'
      AND d.name = patient_schedules.department
  )
);

-- ============================================================================
-- STEP 6: Recreate patient_doctor_view using department_id
-- ============================================================================

-- Recreate the view with department information from departments table
CREATE OR REPLACE VIEW public.patient_doctor_view AS
SELECT
  p.id,
  p.patient_number,
  p.name AS patient_name,
  d.name AS care_type,  -- Now comes from departments table
  p.is_active,
  p.archived,
  p.created_at,
  p.updated_at,
  p.doctor_id,
  p.assigned_doctor_name,
  p.organization_id,
  p.department_id
FROM public.patients p
LEFT JOIN public.departments d ON p.department_id = d.id;

-- ============================================================================
-- STEP 7: Recreate dashboard_schedule_summary materialized view
-- ============================================================================

-- Recreate the materialized view with department information
CREATE MATERIALIZED VIEW public.dashboard_schedule_summary AS
SELECT
  s.id AS schedule_id,
  s.patient_id,
  p.name AS patient_name,
  d.name AS care_type,  -- Now comes from departments table
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
  s.notes,
  CASE
    WHEN s.next_due_date < CURRENT_DATE THEN 'overdue'::text
    WHEN s.next_due_date = CURRENT_DATE THEN 'due_today'::text
    WHEN s.next_due_date <= (CURRENT_DATE + INTERVAL '7 days') THEN 'upcoming'::text
    ELSE 'future'::text
  END AS urgency_status,
  s.organization_id
FROM public.schedules s
INNER JOIN public.patients p ON s.patient_id = p.id
LEFT JOIN public.departments d ON p.department_id = d.id
LEFT JOIN public.profiles doc ON p.doctor_id = doc.id
INNER JOIN public.items i ON s.item_id = i.id
WHERE s.status = 'active';

-- Create indexes on materialized view for better query performance
CREATE INDEX IF NOT EXISTS idx_dashboard_schedule_summary_next_due_date
  ON public.dashboard_schedule_summary (next_due_date);

CREATE INDEX IF NOT EXISTS idx_dashboard_schedule_summary_organization_id
  ON public.dashboard_schedule_summary (organization_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_schedule_summary_care_type
  ON public.dashboard_schedule_summary (care_type);

-- Add comment
COMMENT ON MATERIALIZED VIEW public.dashboard_schedule_summary IS
  'Materialized view for dashboard schedule summary with department information. Refresh periodically for performance.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify columns are dropped
DO $$
DECLARE
    profiles_has_care_type BOOLEAN;
    patients_has_care_type BOOLEAN;
BEGIN
    -- Check if profiles.care_type exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'care_type'
    ) INTO profiles_has_care_type;

    -- Check if patients.care_type exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'patients'
        AND column_name = 'care_type'
    ) INTO patients_has_care_type;

    IF profiles_has_care_type THEN
        RAISE WARNING 'profiles.care_type column still exists!';
    ELSE
        RAISE NOTICE 'profiles.care_type column successfully dropped';
    END IF;

    IF patients_has_care_type THEN
        RAISE WARNING 'patients.care_type column still exists!';
    ELSE
        RAISE NOTICE 'patients.care_type column successfully dropped';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION STATUS: Phase 2 COMPLETE
-- ============================================================================
-- ✅ care_type columns removed from profiles and patients
-- ✅ Application now fully uses departments table with department_id FK
--
-- Next Steps:
-- - Phase 2.1.6: Implement department CRUD API and UI
-- - Phase 2.2: Organization policies and auto-hold feature
-- ============================================================================
