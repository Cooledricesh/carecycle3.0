-- Production-specific script for creating indexes with CONCURRENTLY
-- This script should be run MANUALLY in production OUTSIDE of a transaction
-- Run these commands one by one, monitoring for completion

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Connect to production database directly (not through migration system)
-- 2. Run each command separately
-- 3. Monitor with: SELECT * FROM pg_stat_progress_create_index;
-- 4. After completion, proceed with regular migrations 02, 03, 04
-- ============================================================================

-- Create index on schedules.item_id
-- Estimated time: ~30-60 seconds per 100K rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_item_id
ON public.schedules(item_id);

-- Monitor progress with:
-- SELECT * FROM pg_stat_progress_create_index WHERE relid = 'schedules'::regclass;

-- Create index on schedule_logs.schedule_id
-- Estimated time: ~30-60 seconds per 100K rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_logs_schedule_id
ON public.schedule_logs(schedule_id);

-- Monitor progress with:
-- SELECT * FROM pg_stat_progress_create_index WHERE relid = 'schedule_logs'::regclass;

-- ============================================================================
-- After indexes are created, you can skip migration 01 and proceed with:
-- - 20250119_02_add_fk_not_valid.sql
-- - 20250119_03_validate_fk.sql
-- - 20250119_04_fix_schedule_trigger.sql
-- ============================================================================

-- To verify indexes were created successfully:
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN ('idx_schedules_item_id', 'idx_schedule_logs_schedule_id');