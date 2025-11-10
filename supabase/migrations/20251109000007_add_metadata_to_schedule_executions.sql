-- ============================================================================
-- Migration: Add metadata JSONB column to schedule_executions
-- Created: 2025-11-09
-- Purpose: Store injection dosage and other execution-specific metadata
-- Phase: 3.2.1 - Metadata JSONB Column
-- ============================================================================
--
-- This migration adds a JSONB column to store flexible metadata for schedule
-- executions. This enables storing:
-- - Injection dosage and administration route
-- - Lab test specifications and results
-- - X-ray body parts and findings
-- - Any other execution-specific custom data
--
-- The column is nullable for backward compatibility and uses GIN indexing
-- for efficient JSONB querying.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add metadata column (nullable, default null)
-- ============================================================================
-- Adding as nullable ensures backward compatibility - existing records
-- don't need to be updated, and the column can be populated over time.

ALTER TABLE public.schedule_executions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN public.schedule_executions.metadata IS
  'Execution metadata in JSONB format. Stores execution-specific data like injection dosage, lab test details, or X-ray findings. Example: {"dosage": "10mg", "route": "IV", "notes": "Patient tolerated well"}';

-- ============================================================================
-- STEP 2: Create GIN index for JSONB queries
-- ============================================================================
-- GIN (Generalized Inverted Index) is optimal for JSONB data as it allows
-- efficient queries on JSON keys and values. This supports queries like:
-- WHERE metadata->>'dosage' = '10mg'
-- WHERE metadata @> '{"route": "IV"}'

CREATE INDEX IF NOT EXISTS idx_schedule_executions_metadata
ON public.schedule_executions USING GIN (metadata);

-- Create additional index for common query pattern: filtering by specific JSON keys
-- This index helps with containment queries (@>) and is more compact than default GIN
CREATE INDEX IF NOT EXISTS idx_schedule_executions_metadata_keys
ON public.schedule_executions USING GIN (metadata jsonb_path_ops);

-- ============================================================================
-- STEP 3: Add validation function (optional but recommended)
-- ============================================================================
-- This function can be used by application layer or triggers to validate
-- metadata structure. For now, we keep it simple and let the app handle
-- detailed validation.

CREATE OR REPLACE FUNCTION public.validate_execution_metadata(metadata_json JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Allow NULL metadata
  IF metadata_json IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Ensure it's a JSON object (not array or primitive)
  IF jsonb_typeof(metadata_json) != 'object' THEN
    RETURN FALSE;
  END IF;

  -- Additional validation rules can be added here
  -- For example: check for required fields, data types, etc.

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.validate_execution_metadata(JSONB) IS
  'Validates metadata JSONB structure. Returns TRUE if valid, FALSE otherwise. Can be extended with custom validation rules.';

-- Add check constraint using validation function
ALTER TABLE public.schedule_executions
ADD CONSTRAINT check_metadata_structure
CHECK (validate_execution_metadata(metadata));

-- ============================================================================
-- STEP 4: Verification query
-- ============================================================================
-- Verify that the migration was successful

DO $$
DECLARE
  column_exists BOOLEAN;
  gin_index_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Check if metadata column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'schedule_executions'
    AND column_name = 'metadata'
  ) INTO column_exists;

  -- Check if GIN index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'schedule_executions'
    AND indexname = 'idx_schedule_executions_metadata'
  ) INTO gin_index_exists;

  -- Check if constraint exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'schedule_executions'
    AND constraint_name = 'check_metadata_structure'
  ) INTO constraint_exists;

  -- Report results
  IF column_exists THEN
    RAISE NOTICE '✓ Metadata column added successfully to schedule_executions';
  ELSE
    RAISE WARNING '✗ Failed to add metadata column to schedule_executions';
  END IF;

  IF gin_index_exists THEN
    RAISE NOTICE '✓ GIN index created successfully on metadata column';
  ELSE
    RAISE WARNING '✗ Failed to create GIN index on metadata column';
  END IF;

  IF constraint_exists THEN
    RAISE NOTICE '✓ Validation constraint added successfully';
  ELSE
    RAISE WARNING '✗ Failed to add validation constraint';
  END IF;

  -- Overall success check
  IF column_exists AND gin_index_exists AND constraint_exists THEN
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
-- The metadata column can now be used to store execution-specific data in
-- a flexible JSONB format. This supports various use cases:
--
-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
--
-- 1. INSERT with metadata (Injection category):
-- ----------------------------------------------------------------------------
-- INSERT INTO schedule_executions (
--   schedule_id,
--   planned_date,
--   executed_date,
--   status,
--   metadata,
--   organization_id
-- ) VALUES (
--   'uuid-here',
--   '2025-11-09',
--   '2025-11-09',
--   'completed',
--   '{"dosage": "10mg", "route": "IV", "notes": "Patient tolerated well"}'::jsonb,
--   'org-uuid'
-- );
--
-- 2. INSERT with metadata (Lab test category):
-- ----------------------------------------------------------------------------
-- INSERT INTO schedule_executions (
--   schedule_id,
--   planned_date,
--   metadata,
--   organization_id
-- ) VALUES (
--   'uuid-here',
--   '2025-11-09',
--   '{"test_type": "CBC", "fasting": true, "notes": "Morning draw preferred"}'::jsonb,
--   'org-uuid'
-- );
--
-- 3. INSERT with metadata (X-ray category):
-- ----------------------------------------------------------------------------
-- INSERT INTO schedule_executions (
--   schedule_id,
--   planned_date,
--   executed_date,
--   status,
--   metadata,
--   organization_id
-- ) VALUES (
--   'uuid-here',
--   '2025-11-09',
--   '2025-11-09',
--   'completed',
--   '{"body_part": "chest", "findings": "Normal", "notes": "PA and lateral views"}'::jsonb,
--   'org-uuid'
-- );
--
-- ============================================================================
-- QUERY EXAMPLES
-- ============================================================================
--
-- 1. Find all executions with specific dosage:
-- ----------------------------------------------------------------------------
-- SELECT * FROM schedule_executions
-- WHERE metadata->>'dosage' = '10mg';
--
-- 2. Find all IV injections:
-- ----------------------------------------------------------------------------
-- SELECT * FROM schedule_executions
-- WHERE metadata->>'route' = 'IV';
--
-- 3. Find all fasting lab tests:
-- ----------------------------------------------------------------------------
-- SELECT * FROM schedule_executions
-- WHERE (metadata->>'fasting')::boolean = true;
--
-- 4. Find executions with metadata containing specific key-value:
-- ----------------------------------------------------------------------------
-- SELECT * FROM schedule_executions
-- WHERE metadata @> '{"route": "IV"}'::jsonb;
--
-- 5. Find all executions with notes:
-- ----------------------------------------------------------------------------
-- SELECT * FROM schedule_executions
-- WHERE metadata ? 'notes';
--
-- 6. Update metadata for existing execution:
-- ----------------------------------------------------------------------------
-- UPDATE schedule_executions
-- SET metadata = '{"dosage": "15mg", "route": "IM", "notes": "Updated dosage"}'::jsonb
-- WHERE id = 'uuid-here';
--
-- 7. Merge new metadata with existing (preserving existing fields):
-- ----------------------------------------------------------------------------
-- UPDATE schedule_executions
-- SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"notes": "Additional notes"}'::jsonb
-- WHERE id = 'uuid-here';
--
-- ============================================================================
-- METADATA STRUCTURE EXAMPLES
-- ============================================================================
--
-- Injection category:
-- {
--   "dosage": "10mg",              // Required for injections
--   "route": "IV" | "IM" | "SC",   // Administration route
--   "notes": "Optional notes",     // Free text notes
--   "side_effects": "None",        // Track adverse reactions
--   "administered_by": "Nurse Kim" // Who gave the injection
-- }
--
-- Lab test category:
-- {
--   "test_type": "CBC",            // Type of lab test
--   "fasting": true,               // Boolean flag
--   "notes": "Morning preferred",  // Instructions
--   "result": "pending",           // Test result status
--   "result_value": "120/80",      // Actual result
--   "abnormal": false              // Flag for abnormal results
-- }
--
-- X-ray category:
-- {
--   "body_part": "chest",          // Which body part
--   "views": "PA and lateral",     // X-ray views taken
--   "findings": "Normal",          // Radiologist findings
--   "notes": "...",                // Additional notes
--   "follow_up_required": false    // Flag for follow-up
-- }
--
-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
--
-- The GIN indexes created enable efficient querying on JSONB data:
-- - idx_schedule_executions_metadata: General JSONB queries
-- - idx_schedule_executions_metadata_keys: Optimized for containment queries (@>)
--
-- For best performance:
-- - Use -> for accessing nested objects: metadata->'dosage'
-- - Use ->> for getting text values: metadata->>'dosage'
-- - Use @> for containment checks: metadata @> '{"route": "IV"}'::jsonb
-- - Use ? for key existence: metadata ? 'notes'
--
-- ============================================================================
