-- ============================================================================
-- Migration: Add department_id columns to profiles and patients
-- Created: 2025-11-09
-- Purpose: Add nullable department_id FK columns (Phase 2 - Step 1: ADD)
-- Phase: 2.1.2 - Schema Extension (Non-destructive)
-- ============================================================================

-- CRITICAL: This is a NON-DESTRUCTIVE migration
-- We ADD new columns but DO NOT drop existing care_type columns yet
-- This allows zero-downtime migration with gradual transition

-- STEP 1: Add department_id to profiles table
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department_id UUID
REFERENCES public.departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.department_id IS '소속(부서) ID. care_type을 정규화한 FK. NULL 허용 (마이그레이션 중)';

-- STEP 2: Add department_id to patients table
-- ============================================================================

ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS department_id UUID
REFERENCES public.departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.patients.department_id IS '환자 소속(부서) ID. care_type을 정규화한 FK. NULL 허용 (마이그레이션 중)';

-- STEP 3: Create indexes for FK performance
-- ============================================================================

-- Index for profiles.department_id (improves JOIN performance)
CREATE INDEX IF NOT EXISTS idx_profiles_department_id
ON public.profiles(department_id)
WHERE department_id IS NOT NULL;

-- Index for patients.department_id (improves JOIN performance)
CREATE INDEX IF NOT EXISTS idx_patients_department_id
ON public.patients(department_id)
WHERE department_id IS NOT NULL;

-- STEP 4: Create composite index for organization + department queries
-- ============================================================================

-- Profiles: organization + department (common query pattern)
CREATE INDEX IF NOT EXISTS idx_profiles_org_dept
ON public.profiles(organization_id, department_id)
WHERE department_id IS NOT NULL AND is_active = true;

-- Patients: organization + department (common query pattern)
CREATE INDEX IF NOT EXISTS idx_patients_org_dept
ON public.patients(organization_id, department_id)
WHERE department_id IS NOT NULL AND is_active = true;

-- ============================================================================
-- MIGRATION STATUS: Phase 2 Step 1 COMPLETE
-- ============================================================================
-- Next Steps:
-- 1. Phase 2.1.3: Backfill data (care_type → departments → department_id)
-- 2. Phase 2.1.4: Update application code to use department_id
-- 3. Phase 2.1.5: Drop care_type columns (ONLY after code is fully migrated)
-- ============================================================================
