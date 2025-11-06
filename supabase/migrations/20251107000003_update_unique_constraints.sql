-- Migration: Update UNIQUE constraints to include organization_id
-- Created: 2025-11-07
-- Purpose: Ensure uniqueness per organization (e.g., patient numbers, item codes)

BEGIN;

-- 1. Update patients table unique constraints
-- Drop existing unique constraint on patient_number
ALTER TABLE public.patients
    DROP CONSTRAINT IF EXISTS unique_active_patient_number;

-- Add new unique constraint: patient_number unique per organization (for active, non-archived patients)
CREATE UNIQUE INDEX IF NOT EXISTS unique_patient_number_per_org
    ON public.patients (organization_id, patient_number)
    WHERE is_active = true AND archived = false;

COMMENT ON INDEX unique_patient_number_per_org IS '조직별 환자번호 고유성 (활성, 비보관 환자만)';

-- 2. Update items table unique constraints
-- Drop existing unique constraint on code
ALTER TABLE public.items
    DROP CONSTRAINT IF EXISTS items_code_key;

-- Add new unique constraint: code unique per organization
ALTER TABLE public.items
    ADD CONSTRAINT unique_item_code_per_org UNIQUE (organization_id, code);

COMMENT ON CONSTRAINT unique_item_code_per_org ON public.items IS '조직별 항목 코드 고유성';

-- 3. Update schedules table unique constraints
-- The existing unique_schedule_date constraint on schedule_executions is fine
-- as it prevents duplicate schedule-date combinations which should remain global

-- 4. Note: profiles.email is globally unique (managed by auth.users)
-- No changes needed for profiles table

COMMIT;
