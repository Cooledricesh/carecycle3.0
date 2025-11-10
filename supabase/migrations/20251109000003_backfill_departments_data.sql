-- ============================================================================
-- Migration: Backfill departments table and update department_id columns
-- Created: 2025-11-09
-- Purpose: Migrate care_type data to normalized departments structure
-- Phase: 2.1.3 - Data Synchronization (BACKFILL)
-- ============================================================================

-- CRITICAL: This migration MUST run AFTER 20251109000001 and 20251109000002
-- It migrates existing care_type data into the new departments structure

-- ============================================================================
-- STEP 1: Insert unique care_type values as departments
-- ============================================================================

-- Insert departments from profiles care_type values
INSERT INTO public.departments (name, organization_id, display_order, created_at, updated_at)
SELECT DISTINCT
    p.care_type AS name,
    p.organization_id,
    CASE p.care_type
        WHEN '외래' THEN 1
        WHEN '입원' THEN 2
        WHEN '낮병원' THEN 3
        ELSE 99
    END AS display_order,
    NOW() AS created_at,
    NOW() AS updated_at
FROM public.profiles p
WHERE p.care_type IS NOT NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- Insert additional departments from patients care_type values
-- (in case patients have care_types not in profiles)
INSERT INTO public.departments (name, organization_id, display_order, created_at, updated_at)
SELECT DISTINCT
    pt.care_type AS name,
    pt.organization_id,
    CASE pt.care_type
        WHEN '외래' THEN 1
        WHEN '입원' THEN 2
        WHEN '낮병원' THEN 3
        ELSE 99
    END AS display_order,
    NOW() AS created_at,
    NOW() AS updated_at
FROM public.patients pt
WHERE pt.care_type IS NOT NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- ============================================================================
-- STEP 2: Update profiles.department_id based on care_type
-- ============================================================================

-- Update profiles to reference new departments
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE p.care_type IS NOT NULL
  AND d.name = p.care_type
  AND d.organization_id = p.organization_id
  AND p.department_id IS NULL;  -- Only update if not already set

-- ============================================================================
-- STEP 3: Update patients.department_id based on care_type
-- ============================================================================

-- Update patients to reference new departments
UPDATE public.patients pt
SET department_id = d.id
FROM public.departments d
WHERE pt.care_type IS NOT NULL
  AND d.name = pt.care_type
  AND d.organization_id = pt.organization_id
  AND pt.department_id IS NULL;  -- Only update if not already set

-- ============================================================================
-- STEP 4: Verification queries (output to logs)
-- ============================================================================

-- Check departments created
DO $$
DECLARE
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dept_count FROM public.departments;
    RAISE NOTICE 'Total departments created: %', dept_count;
END $$;

-- Check profiles migration status
DO $$
DECLARE
    migrated_count INTEGER;
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM public.profiles
    WHERE care_type IS NOT NULL AND department_id IS NOT NULL;

    SELECT COUNT(*) INTO unmigrated_count
    FROM public.profiles
    WHERE care_type IS NOT NULL AND department_id IS NULL;

    RAISE NOTICE 'Profiles migrated: %, unmigrated: %', migrated_count, unmigrated_count;
END $$;

-- Check patients migration status
DO $$
DECLARE
    migrated_count INTEGER;
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM public.patients
    WHERE care_type IS NOT NULL AND department_id IS NOT NULL;

    SELECT COUNT(*) INTO unmigrated_count
    FROM public.patients
    WHERE care_type IS NOT NULL AND department_id IS NULL;

    RAISE NOTICE 'Patients migrated: %, unmigrated: %', migrated_count, unmigrated_count;
END $$;

-- ============================================================================
-- MIGRATION STATUS: Phase 2 Step 2 COMPLETE
-- ============================================================================
-- Data has been migrated from care_type to department_id
-- Both care_type and department_id columns now coexist
--
-- Next Steps:
-- 1. Phase 2.1.4: Update application code to use department_id + JOIN departments
-- 2. Verify application works correctly with new structure
-- 3. Phase 2.1.5: Drop care_type columns (ONLY after verification)
-- ============================================================================
