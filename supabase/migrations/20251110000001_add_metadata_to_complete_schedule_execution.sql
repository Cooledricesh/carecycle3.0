-- ============================================================================
-- Migration: Add metadata parameter to complete_schedule_execution RPC function
-- Created: 2025-11-10
-- Purpose: Update complete_schedule_execution to accept and store metadata
-- Related: PR50 - Type safety improvements
-- ============================================================================
--
-- This migration updates the complete_schedule_execution RPC function to
-- accept a p_metadata parameter, enabling injection dosage tracking and
-- other execution-specific metadata to be stored via the RPC call.
--
-- Context:
-- - Migration 20251109000007 added metadata column to schedule_executions table
-- - TypeScript code already passes p_metadata parameter (scheduleService.ts:963)
-- - This migration adds support for that parameter in the database function
-- ============================================================================

BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS public.complete_schedule_execution(uuid, date, date, uuid, text);

-- Recreate function with metadata parameter
CREATE OR REPLACE FUNCTION public.complete_schedule_execution(
    p_schedule_id UUID,
    p_planned_date DATE,
    p_executed_date DATE,
    p_executed_by UUID,
    p_notes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_execution_id UUID;
    v_organization_id UUID;
BEGIN
    -- Get organization_id from schedule
    SELECT organization_id INTO v_organization_id
    FROM schedules
    WHERE id = p_schedule_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
    END IF;

    -- Try to INSERT first
    BEGIN
        INSERT INTO schedule_executions (
            schedule_id,
            organization_id,
            planned_date,
            executed_date,
            executed_time,
            status,
            executed_by,
            notes,
            metadata
        ) VALUES (
            p_schedule_id,
            v_organization_id,
            p_planned_date,
            p_executed_date,
            CURRENT_TIME,
            'completed',
            p_executed_by,
            p_notes,
            p_metadata
        );
    EXCEPTION
        WHEN unique_violation THEN
            -- If record exists, UPDATE instead
            UPDATE schedule_executions
            SET
                executed_date = p_executed_date,
                executed_time = CURRENT_TIME,
                status = 'completed',
                executed_by = p_executed_by,
                notes = COALESCE(p_notes, notes),
                metadata = COALESCE(p_metadata, metadata),
                updated_at = CURRENT_TIMESTAMP
            WHERE schedule_id = p_schedule_id
              AND planned_date = p_planned_date;
    END;

    -- Update schedule's next_due_date based on interval
    UPDATE schedules
    SET
        next_due_date = p_executed_date + (interval_weeks || ' weeks')::INTERVAL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.complete_schedule_execution(uuid, date, date, uuid, text, jsonb) IS
  'Complete a schedule execution with optional metadata (injection dosage, lab test details, etc.)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_schedule_execution(uuid, date, date, uuid, text, jsonb) TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    function_exists BOOLEAN;
BEGIN
    -- Check if function exists with correct signature
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'complete_schedule_execution'
        AND p.pronargs = 6  -- 6 parameters including new metadata parameter
    ) INTO function_exists;

    IF function_exists THEN
        RAISE NOTICE '✓ Function complete_schedule_execution updated successfully with metadata parameter';
    ELSE
        RAISE WARNING '✗ Function update verification failed';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- The complete_schedule_execution function now accepts p_metadata parameter
-- and stores it in the schedule_executions table.
--
-- Usage example:
-- SELECT complete_schedule_execution(
--   'schedule-uuid',
--   '2025-11-10',
--   '2025-11-10',
--   'user-uuid',
--   'Injection completed successfully',
--   '{"dosage": "10mg", "route": "IV"}'::jsonb
-- );
-- ============================================================================
