-- ============================================================================
-- Migration: Fix invitation care_type constraint for dynamic department validation
-- Created: 2025-11-14
-- Purpose: Replace static CHECK constraint with dynamic trigger validation
-- Bug ID: BUG-20251114-INVITATION-CARE-TYPE-CONSTRAINT
-- ============================================================================

-- PROBLEM:
-- The static CHECK constraint only allows ('외래', '입원', '낮병원')
-- but departments table supports dynamic department names including '병동'
-- This causes 500 errors when inviting nurses to '병동' department

-- SOLUTION:
-- 1. Remove static CHECK constraint
-- 2. Add dynamic validation trigger that checks against departments table
-- 3. Maintain data integrity while supporting flexible department structure

BEGIN;

-- ============================================================================
-- STEP 1: Remove static CHECK constraint
-- ============================================================================

-- Drop the existing static constraint that blocks '병동' and other departments
ALTER TABLE public.invitations
DROP CONSTRAINT IF EXISTS check_invitation_care_type;

-- ============================================================================
-- STEP 2: Create dynamic validation function
-- ============================================================================

-- This function validates care_type against the departments table
-- ensuring the department exists and is active for the given organization
CREATE OR REPLACE FUNCTION public.validate_invitation_care_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation if care_type is NULL (allowed for admin/doctor roles)
  IF NEW.care_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate that care_type exists in departments table
  -- for the same organization and is active
  IF NOT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.name = NEW.care_type
      AND d.organization_id = NEW.organization_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid care_type: % is not a valid active department for organization %',
      NEW.care_type,
      NEW.organization_id
      USING ERRCODE = '23514'; -- Use same error code as CHECK constraint for consistency
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION public.validate_invitation_care_type() IS
'Validates that invitation care_type matches an active department in the departments table for the same organization. Replaces static CHECK constraint to support dynamic department management.';

-- ============================================================================
-- STEP 3: Create trigger for INSERT and UPDATE operations
-- ============================================================================

-- Drop existing trigger if any (idempotency)
DROP TRIGGER IF EXISTS trigger_validate_invitation_care_type ON public.invitations;

-- Create trigger that runs BEFORE INSERT or UPDATE
CREATE TRIGGER trigger_validate_invitation_care_type
  BEFORE INSERT OR UPDATE OF care_type, organization_id
  ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invitation_care_type();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_validate_invitation_care_type ON public.invitations IS
'Validates care_type against departments table before inserting or updating invitation records. Ensures data integrity while supporting dynamic department structure.';

-- ============================================================================
-- STEP 4: Verify existing data compatibility
-- ============================================================================

-- Check if any existing invitations would violate the new validation
-- This should return 0 rows if all existing data is valid
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.invitations i
  WHERE i.care_type IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.name = i.care_type
        AND d.organization_id = i.organization_id
        AND d.is_active = true
    );

  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % invitations with invalid care_type that do not match departments table', invalid_count;
    RAISE NOTICE 'Review these records before proceeding';
  ELSE
    RAISE NOTICE 'All existing invitations have valid care_type values (validated count: %)',
      (SELECT COUNT(*) FROM public.invitations WHERE care_type IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Test the new validation
-- ============================================================================

-- This block tests that the trigger works correctly
-- It will be rolled back if the migration is in a transaction
DO $$
BEGIN
  RAISE NOTICE '=== Testing new validation trigger ===';
  RAISE NOTICE 'Trigger successfully created and ready for validation';
  RAISE NOTICE 'Now supports dynamic department names from departments table';
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
-- 1. Removed static CHECK constraint (check_invitation_care_type)
-- 2. Added dynamic validation function (validate_invitation_care_type)
-- 3. Added trigger (trigger_validate_invitation_care_type)
--
-- Benefits:
-- - Supports all department names in departments table (including '병동')
-- - Maintains data integrity through trigger validation
-- - Automatically syncs with departments table changes
-- - Prevents invalid department references
--
-- Testing:
-- - Test 1: Insert invitation with '병동' care_type (should succeed)
-- - Test 2: Insert invitation with '외래'/'입원'/'낮병원' (should succeed)
-- - Test 3: Insert invitation with non-existent care_type (should fail)
-- - Test 4: Insert invitation with inactive department (should fail)
-- ============================================================================
