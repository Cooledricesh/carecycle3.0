-- ============================================================================
-- Supabase Performance Monitoring Dashboard
-- ============================================================================
-- Created: 2025-11-12
-- Purpose: Track database performance improvements after optimization
--
-- Usage:
-- 1. Run these queries periodically (daily/weekly)
-- 2. Compare results before and after optimizations
-- 3. Identify regressions or new bottlenecks
-- ============================================================================

-- ============================================================================
-- SECTION 1: Index Usage Analysis
-- ============================================================================

-- Query 1.1: Verify new indexes are being used
-- Expected: idx_scan count should increase over time
SELECT
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN '🔴 Unused'
    WHEN idx_scan < 100 THEN '🟡 Low Usage'
    WHEN idx_scan < 1000 THEN '🟢 Moderate'
    ELSE '✅ High Usage'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname IN (
    'idx_invitations_invited_by',
    'idx_patient_schedules_created_by',
    'idx_patient_schedules_nurse_id'
  )
ORDER BY idx_scan DESC;

-- Query 1.2: Check for new unused indexes
-- Action: If any indexes show 0 scans after 1 week, consider removing
SELECT
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 10
  AND pg_relation_size(indexrelid) > 100000  -- > 100 KB
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ============================================================================
-- SECTION 2: Query Performance Analysis
-- ============================================================================

-- Query 2.1: Slowest queries (requires pg_stat_statements extension)
-- Note: Enable with CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  ROUND(total_exec_time::numeric, 2) as total_time_ms,
  ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
  ROUND(max_exec_time::numeric, 2) as max_time_ms,
  ROUND(((total_exec_time / sum(total_exec_time) OVER()) * 100)::numeric, 2) as pct_total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%information_schema%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Query 2.2: Queries with high execution count
-- These are candidates for optimization or caching
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
  ROUND((calls * mean_exec_time)::numeric, 2) as total_impact_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 20;

-- ============================================================================
-- SECTION 3: Table Size and Bloat Analysis
-- ============================================================================

-- Query 3.1: Largest tables with growth tracking
SELECT
  t.schemaname,
  t.tablename,
  pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(t.schemaname||'.'||t.tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename) -
                 pg_relation_size(t.schemaname||'.'||t.tablename)) AS indexes_size,
  s.n_tup_ins as inserts,
  s.n_tup_upd as updates,
  s.n_tup_del as deletes,
  s.n_live_tup as live_rows,
  s.n_dead_tup as dead_rows,
  CASE
    WHEN s.n_live_tup > 0 THEN
      ROUND((s.n_dead_tup::float / s.n_live_tup::float * 100)::numeric, 2)
    ELSE 0
  END as dead_row_pct
FROM pg_tables t
JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC
LIMIT 15;

-- Query 3.2: Tables needing VACUUM
-- Action: If dead_row_pct > 20%, run VACUUM ANALYZE
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  ROUND((n_dead_tup::float / NULLIF(n_live_tup, 0)::float * 100)::numeric, 2) as dead_row_pct,
  last_vacuum,
  last_autovacuum,
  CASE
    WHEN n_dead_tup::float / NULLIF(n_live_tup, 0)::float > 0.2 THEN '🔴 VACUUM NEEDED'
    WHEN n_dead_tup::float / NULLIF(n_live_tup, 0)::float > 0.1 THEN '🟡 Monitor'
    ELSE '✅ OK'
  END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_row_pct DESC NULLS LAST;

-- ============================================================================
-- SECTION 4: RLS Policy Performance
-- ============================================================================

-- Query 4.1: Check if RLS helper functions are being called
-- Expected: Increasing calls = policies are active
SELECT
  p.proname as function_name,
  pg_stat_user_functions.calls,
  ROUND(pg_stat_user_functions.total_time::numeric, 2) as total_time_ms,
  ROUND(pg_stat_user_functions.self_time::numeric, 2) as self_time_ms,
  ROUND((pg_stat_user_functions.self_time / NULLIF(pg_stat_user_functions.calls, 0))::numeric, 4) as avg_time_ms
FROM pg_stat_user_functions
JOIN pg_proc p ON p.oid = pg_stat_user_functions.funcid
WHERE p.proname IN (
  'is_user_active_and_approved',
  'is_clinical_staff',
  'has_role'
)
ORDER BY calls DESC;

-- Query 4.2: Most complex RLS policies
-- Monitor for policies that may need optimization
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  length(qual::text) as policy_length,
  CASE
    WHEN length(qual::text) > 300 THEN '🔴 Very Complex'
    WHEN length(qual::text) > 150 THEN '🟡 Complex'
    ELSE '✅ Simple'
  END as complexity
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY length(qual::text) DESC
LIMIT 10;

-- ============================================================================
-- SECTION 5: Connection and Lock Analysis
-- ============================================================================

-- Query 5.1: Active connections by state
SELECT
  state,
  COUNT(*) as connection_count,
  MAX(EXTRACT(EPOCH FROM (now() - state_change))) as max_duration_seconds
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY connection_count DESC;

-- Query 5.2: Long-running queries (> 1 minute)
-- Action: Investigate and optimize these queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  substring(query, 1, 100) as query_preview
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 minute'
  AND state != 'idle'
  AND datname = current_database()
ORDER BY duration DESC;

-- Query 5.3: Lock contention
-- Action: If locks > 0, investigate blocking queries
SELECT
  pg_stat_activity.pid,
  pg_class.relname as table_name,
  pg_locks.mode,
  pg_locks.granted,
  substring(pg_stat_activity.query, 1, 100) as query_preview
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
WHERE NOT pg_locks.granted
  AND pg_class.relnamespace = 'public'::regnamespace
ORDER BY pg_stat_activity.query_start;

-- ============================================================================
-- SECTION 6: Function Performance
-- ============================================================================

-- Query 6.1: Slowest database functions
SELECT
  schemaname,
  funcname as function_name,
  calls,
  ROUND(total_time::numeric, 2) as total_time_ms,
  ROUND(self_time::numeric, 2) as self_time_ms,
  ROUND((self_time / NULLIF(calls, 0))::numeric, 4) as avg_time_ms,
  CASE
    WHEN self_time / NULLIF(calls, 0) > 100 THEN '🔴 Slow'
    WHEN self_time / NULLIF(calls, 0) > 50 THEN '🟡 Medium'
    ELSE '✅ Fast'
  END as performance
FROM pg_stat_user_functions
WHERE schemaname = 'public'
ORDER BY self_time DESC
LIMIT 15;

-- Query 6.2: User deletion and audit function performance
-- Track check_last_admin, anonymize_user_audit_logs, and other critical functions
SELECT
  funcname as function_name,
  calls,
  ROUND(total_time::numeric, 2) as total_time_ms,
  ROUND(self_time::numeric, 2) as self_time_ms,
  ROUND((self_time / NULLIF(calls, 0))::numeric, 2) as avg_time_ms
FROM pg_stat_user_functions
WHERE funcname IN (
  'check_last_admin',
  'anonymize_user_audit_logs',
  'calculate_next_due_date'
)
ORDER BY funcname;

-- ============================================================================
-- SECTION 7: Cache Hit Ratios
-- ============================================================================

-- Query 7.1: Table cache hit ratio
-- Target: > 99% for frequently accessed tables
SELECT
  schemaname,
  relname as table_name,
  heap_blks_read as disk_reads,
  heap_blks_hit as cache_hits,
  CASE
    WHEN (heap_blks_hit + heap_blks_read) > 0 THEN
      ROUND((heap_blks_hit::float / (heap_blks_hit + heap_blks_read)::float * 100)::numeric, 2)
    ELSE 0
  END as cache_hit_ratio,
  CASE
    WHEN (heap_blks_hit + heap_blks_read) > 0 THEN
      CASE
        WHEN (heap_blks_hit::float / (heap_blks_hit + heap_blks_read)::float) > 0.99 THEN '✅ Excellent'
        WHEN (heap_blks_hit::float / (heap_blks_hit + heap_blks_read)::float) > 0.95 THEN '🟢 Good'
        WHEN (heap_blks_hit::float / (heap_blks_hit + heap_blks_read)::float) > 0.90 THEN '🟡 Fair'
        ELSE '🔴 Poor'
      END
    ELSE 'N/A'
  END as status
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND (heap_blks_hit + heap_blks_read) > 1000  -- Only tables with significant access
ORDER BY cache_hit_ratio ASC
LIMIT 15;

-- Query 7.2: Index cache hit ratio
-- Target: > 99%
SELECT
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_blks_read as disk_reads,
  idx_blks_hit as cache_hits,
  CASE
    WHEN (idx_blks_hit + idx_blks_read) > 0 THEN
      ROUND((idx_blks_hit::float / (idx_blks_hit + idx_blks_read)::float * 100)::numeric, 2)
    ELSE 0
  END as cache_hit_ratio
FROM pg_statio_user_indexes
WHERE schemaname = 'public'
  AND (idx_blks_hit + idx_blks_read) > 100
ORDER BY cache_hit_ratio ASC
LIMIT 15;

-- ============================================================================
-- SECTION 8: Summary Dashboard
-- ============================================================================

-- Query 8.1: Overall database health summary
WITH health_metrics AS (
  -- Total DB size
  SELECT
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    '📊' as icon
  UNION ALL
  -- Active connections
  SELECT
    'Active Connections',
    COUNT(*)::text,
    '🔌'
  FROM pg_stat_activity
  WHERE state = 'active' AND datname = current_database()
  UNION ALL
  -- Tables needing vacuum
  SELECT
    'Tables Needing VACUUM',
    COUNT(*)::text,
    '🧹'
  FROM pg_stat_user_tables
  WHERE n_dead_tup::float / NULLIF(n_live_tup, 0)::float > 0.2
  UNION ALL
  -- New indexes created
  SELECT
    'New Indexes Usage',
    CASE
      WHEN SUM(idx_scan) > 100 THEN '✅ Active'
      WHEN SUM(idx_scan) > 10 THEN '🟡 Starting'
      ELSE '🔴 Not Used Yet'
    END,
    '📈'
  FROM pg_stat_user_indexes
  WHERE indexrelname IN (
    'idx_invitations_invited_by',
    'idx_patient_schedules_created_by',
    'idx_patient_schedules_nurse_id'
  )
)
SELECT
  icon,
  metric,
  value
FROM health_metrics;

-- ============================================================================
-- MAINTENANCE COMMANDS
-- ============================================================================
-- Run these periodically to maintain performance:

-- Vacuum and analyze all tables
-- VACUUM ANALYZE;

-- Vacuum specific large table
-- VACUUM ANALYZE public.audit_logs;

-- Reindex if index bloat detected
-- REINDEX TABLE CONCURRENTLY public.schedules;

-- Reset statistics (use carefully, only when needed)
-- SELECT pg_stat_reset();

-- ============================================================================
-- EXPORT REPORT
-- ============================================================================
-- To save results to CSV:
-- \copy (SELECT * FROM query_here) TO '/path/to/report.csv' CSV HEADER
