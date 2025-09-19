-- Pre-migration validation script
-- Run this BEFORE applying the FK cascade migrations to check for data integrity issues
-- This script is READ-ONLY and makes no changes to the database

-- ============================================================================
-- 1. Check for orphaned records that would prevent FK constraint validation
-- ============================================================================

WITH orphan_check AS (
    -- Check for schedules referencing non-existent items
    SELECT
        'schedules.item_id' as table_column,
        COUNT(*) as orphan_count,
        STRING_AGG(s.id::text, ', ' ORDER BY s.id LIMIT 10) as sample_ids
    FROM schedules s
    LEFT JOIN items i ON s.item_id = i.id
    WHERE s.item_id IS NOT NULL AND i.id IS NULL

    UNION ALL

    -- Check for schedule_logs referencing non-existent schedules
    SELECT
        'schedule_logs.schedule_id',
        COUNT(*),
        STRING_AGG(sl.id::text, ', ' ORDER BY sl.id LIMIT 10)
    FROM schedule_logs sl
    LEFT JOIN schedules s ON sl.schedule_id = s.id
    WHERE sl.schedule_id IS NOT NULL AND s.id IS NULL
)
SELECT
    table_column,
    orphan_count,
    CASE
        WHEN orphan_count > 0 THEN 'ERROR: Orphaned records found! Sample IDs: ' || sample_ids
        ELSE 'OK: No orphaned records'
    END as status
FROM orphan_check
ORDER BY table_column;

-- ============================================================================
-- 2. Check existing indexes
-- ============================================================================

SELECT
    'Index Check' as check_type,
    tablename,
    indexname,
    CASE
        WHEN indexname IN ('idx_schedules_item_id', 'idx_schedule_logs_schedule_id')
        THEN 'OK: Index exists'
        ELSE 'INFO: Will be created'
    END as status
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('schedules', 'schedule_logs')
AND (indexname LIKE '%item_id%' OR indexname LIKE '%schedule_id%')

UNION ALL

SELECT
    'Index Check',
    'schedules',
    'idx_schedules_item_id',
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_schedules_item_id')
        THEN 'OK: Index exists'
        ELSE 'INFO: Will be created'
    END

UNION ALL

SELECT
    'Index Check',
    'schedule_logs',
    'idx_schedule_logs_schedule_id',
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_schedule_logs_schedule_id')
        THEN 'OK: Index exists'
        ELSE 'INFO: Will be created'
    END
ORDER BY tablename, indexname;

-- ============================================================================
-- 3. Check existing foreign key constraints
-- ============================================================================

SELECT
    'FK Constraint Check' as check_type,
    tc.table_name,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule,
    CASE
        WHEN rc.delete_rule = 'CASCADE' THEN 'OK: Already CASCADE'
        WHEN rc.delete_rule IS NOT NULL THEN 'INFO: Will change to CASCADE'
        ELSE 'INFO: Will be added'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('schedules', 'schedule_logs')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- 4. Check table sizes for migration planning
-- ============================================================================

SELECT
    'Table Size' as check_type,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_live_tup as approximate_row_count,
    CASE
        WHEN n_live_tup > 1000000 THEN 'WARNING: Large table - consider using CONCURRENTLY'
        WHEN n_live_tup > 100000 THEN 'INFO: Medium table - monitor during migration'
        ELSE 'OK: Small table - migration should be fast'
    END as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('schedules', 'schedule_logs', 'items')
ORDER BY n_live_tup DESC;

-- ============================================================================
-- 5. Check for active connections that might block migration
-- ============================================================================

SELECT
    'Active Connections' as check_type,
    COUNT(*) as connection_count,
    CASE
        WHEN COUNT(*) > 50 THEN 'WARNING: High connection count - consider maintenance window'
        WHEN COUNT(*) > 20 THEN 'INFO: Moderate connections - monitor during migration'
        ELSE 'OK: Low connection count'
    END as status
FROM pg_stat_activity
WHERE state != 'idle'
AND pid != pg_backend_pid();

-- ============================================================================
-- 6. Summary and recommendations
-- ============================================================================

DO $$
DECLARE
    has_orphans BOOLEAN;
    large_tables BOOLEAN;
BEGIN
    -- Check for orphans
    SELECT EXISTS (
        SELECT 1 FROM schedules s
        LEFT JOIN items i ON s.item_id = i.id
        WHERE s.item_id IS NOT NULL AND i.id IS NULL
    ) OR EXISTS (
        SELECT 1 FROM schedule_logs sl
        LEFT JOIN schedules s ON sl.schedule_id = s.id
        WHERE sl.schedule_id IS NOT NULL AND s.id IS NULL
    ) INTO has_orphans;

    -- Check for large tables
    SELECT EXISTS (
        SELECT 1 FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND tablename IN ('schedules', 'schedule_logs')
        AND n_live_tup > 1000000
    ) INTO large_tables;

    RAISE NOTICE '';
    RAISE NOTICE '========== MIGRATION READINESS SUMMARY ==========';

    IF has_orphans THEN
        RAISE WARNING 'CRITICAL: Orphaned records detected! These must be cleaned before migration.';
        RAISE NOTICE 'Fix with: DELETE FROM schedules WHERE item_id NOT IN (SELECT id FROM items);';
        RAISE NOTICE 'Or: UPDATE schedules SET item_id = NULL WHERE item_id NOT IN (SELECT id FROM items);';
    ELSE
        RAISE NOTICE '✓ Data integrity check passed';
    END IF;

    IF large_tables THEN
        RAISE NOTICE '';
        RAISE NOTICE 'RECOMMENDATION: Large tables detected. Consider:';
        RAISE NOTICE '1. Running migrations during maintenance window';
        RAISE NOTICE '2. Using CONCURRENTLY for index creation (manually)';
        RAISE NOTICE '3. Monitoring lock contention during validation';
    ELSE
        RAISE NOTICE '✓ Table sizes are manageable for standard migration';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Fix any orphaned records if found';
    RAISE NOTICE '2. Apply migrations in order: 01, 02, 03, 04';
    RAISE NOTICE '3. For large tables, consider manual CONCURRENTLY approach';
    RAISE NOTICE '==================================================';
END $$;