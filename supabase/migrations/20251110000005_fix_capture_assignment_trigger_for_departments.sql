-- ============================================================================
-- Migration: Fix capture_assignment_at_completion trigger for department migration
-- Created: 2025-11-10
-- Purpose: Update trigger to use department_id instead of deleted care_type column
-- Related: Issue #51 - Schedule completion failure after department migration
-- ============================================================================
--
-- Context:
-- - Migration 20251109000004_drop_care_type_columns removed care_type from patients
-- - But capture_assignment_at_completion() trigger still references p.care_type
-- - This causes "column p.care_type does not exist" error on schedule completion
--
-- Solution:
-- - Update trigger function to use p.department_id instead of p.care_type
-- - Keep care_type_at_completion column for backward compatibility (stores department_id value)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop and recreate trigger function with department_id
-- ============================================================================

DROP FUNCTION IF EXISTS public.capture_assignment_at_completion() CASCADE;

CREATE OR REPLACE FUNCTION public.capture_assignment_at_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only capture on completion
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get current doctor_id and department_id from patient
    -- Store department_id in care_type_at_completion for backward compatibility
    SELECT p.doctor_id, p.department_id
    INTO NEW.doctor_id_at_completion, NEW.care_type_at_completion
    FROM patients p
    JOIN schedules s ON s.patient_id = p.id
    WHERE s.id = NEW.schedule_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.capture_assignment_at_completion() IS
  'Captures doctor_id and department_id at completion time. Stores department_id in care_type_at_completion for backward compatibility.';

-- ============================================================================
-- STEP 2: Recreate the trigger
-- ============================================================================

DROP TRIGGER IF EXISTS capture_assignment_before_completion ON public.schedule_executions;

CREATE TRIGGER capture_assignment_before_completion
  BEFORE INSERT OR UPDATE ON public.schedule_executions
  FOR EACH ROW
  EXECUTE FUNCTION capture_assignment_at_completion();

-- ============================================================================
-- STEP 3: Update existing records (optional - for data consistency)
-- ============================================================================
-- Update existing records that have care_type_at_completion but need department_id
-- This is optional since old records are already completed and don't need changes

-- Example (commented out - uncomment only if needed):
-- UPDATE schedule_executions se
-- SET care_type_at_completion = p.department_id
-- FROM schedules s
-- JOIN patients p ON s.patient_id = p.id
-- WHERE se.schedule_id = s.id
--   AND se.care_type_at_completion IS NOT NULL
--   AND p.department_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

DO $$
DECLARE
  function_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'capture_assignment_at_completion'
  ) INTO function_exists;

  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'capture_assignment_before_completion'
  ) INTO trigger_exists;

  IF function_exists THEN
    RAISE NOTICE '✓ Function capture_assignment_at_completion recreated successfully';
  ELSE
    RAISE WARNING '✗ Failed to create function capture_assignment_at_completion';
  END IF;

  IF trigger_exists THEN
    RAISE NOTICE '✓ Trigger capture_assignment_before_completion recreated successfully';
  ELSE
    RAISE WARNING '✗ Failed to create trigger capture_assignment_before_completion';
  END IF;

  IF function_exists AND trigger_exists THEN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '==================================================';
  ELSE
    RAISE EXCEPTION 'Migration incomplete - check warnings above';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- The trigger now correctly references p.department_id instead of p.care_type
-- Schedule completion should now work without errors
--
-- Testing:
-- 1. Complete a schedule execution via the UI
-- 2. Verify the execution record is created successfully
-- 3. Check that doctor_id_at_completion and care_type_at_completion are populated
-- ============================================================================
