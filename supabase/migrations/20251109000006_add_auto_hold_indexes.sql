-- ============================================================================
-- Migration: Add composite indexes for auto-hold feature performance
-- Created: 2025-11-09
-- Purpose: Optimize queries for auto-hold Edge Function
-- Phase: 2.2.3 - Auto-hold Performance Optimization
-- ============================================================================

-- STEP 1: Create composite index on schedules for auto-hold queries
-- ============================================================================

-- Index for finding active/paused schedules with overdue next_due_date
-- This index supports the query:
-- SELECT * FROM schedules
-- WHERE status IN ('active', 'paused')
-- AND next_due_date < CURRENT_DATE - interval 'X days'
CREATE INDEX IF NOT EXISTS idx_schedules_auto_hold
ON public.schedules(status, next_due_date)
WHERE status IN ('active', 'paused');

-- ============================================================================
-- STEP 2: Verify index creation
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'schedules'
        AND indexname = 'idx_schedules_auto_hold'
    ) THEN
        RAISE NOTICE 'Composite index idx_schedules_auto_hold created successfully';
    ELSE
        RAISE WARNING 'Failed to create composite index idx_schedules_auto_hold';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This index will significantly improve performance of the auto-hold Edge Function
-- by allowing fast lookup of overdue schedules without full table scan.
--
-- Expected query plan:
-- - Index Scan using idx_schedules_auto_hold
-- - Filter: next_due_date < (current_date - policy.auto_hold_overdue_days)
--
-- Performance impact:
-- - Before: O(n) full table scan
-- - After: O(log n) index scan + O(k) where k = matching rows
-- ============================================================================
