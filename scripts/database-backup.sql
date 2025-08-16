-- Healthcare Scheduler Database Backup Script
-- Run this script periodically for database maintenance and monitoring

-- 1. Database Health Check Queries
-- ================================

-- Check database size and growth
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    current_database() as database_name,
    NOW() as check_time;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_stat_get_live_tuples(c.oid) as live_tuples,
    pg_stat_get_dead_tuples(c.oid) as dead_tuples
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 2. Performance Monitoring Queries
-- =================================

-- Check slow queries (if pg_stat_statements is enabled)
-- SELECT 
--     query,
--     calls,
--     total_time,
--     mean_time,
--     rows,
--     100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
-- FROM pg_stat_statements
-- WHERE query NOT LIKE '%pg_stat_statements%'
-- ORDER BY total_time DESC
-- LIMIT 10;

-- Check connection count
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE pid != pg_backend_pid();

-- Check locks
SELECT 
    mode,
    locktype,
    count(*)
FROM pg_locks
WHERE pid != pg_backend_pid()
GROUP BY mode, locktype
ORDER BY count(*) DESC;

-- 3. Application-Specific Health Checks
-- =====================================

-- Check user distribution by role
SELECT 
    role,
    count(*) as user_count,
    count(*) FILTER (WHERE is_active = true) as active_users
FROM public.profiles
GROUP BY role;

-- Check schedule distribution by status
SELECT 
    status,
    count(*) as schedule_count,
    count(*) FILTER (WHERE scheduled_date >= CURRENT_DATE) as future_schedules
FROM public.patient_schedules
GROUP BY status;

-- Check recent activity (last 24 hours)
SELECT 
    table_name,
    operation,
    count(*) as operation_count
FROM public.audit_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY table_name, operation
ORDER BY operation_count DESC;

-- Check for potential issues
SELECT 
    'Schedule Conflicts' as issue_type,
    count(*) as count
FROM public.patient_schedules s1
JOIN public.patient_schedules s2 ON s1.nurse_id = s2.nurse_id 
    AND s1.scheduled_date = s2.scheduled_date
    AND s1.id != s2.id
    AND s1.status NOT IN ('cancelled', 'no_show')
    AND s2.status NOT IN ('cancelled', 'no_show')
WHERE s1.scheduled_time < s2.scheduled_time + (s2.duration_minutes || ' minutes')::INTERVAL
AND s2.scheduled_time < s1.scheduled_time + (s1.duration_minutes || ' minutes')::INTERVAL

UNION ALL

SELECT 
    'Orphaned Schedules' as issue_type,
    count(*) as count
FROM public.patient_schedules
WHERE nurse_id IS NOT NULL 
AND nurse_id NOT IN (SELECT id FROM public.profiles WHERE is_active = true)

UNION ALL

SELECT 
    'Past Schedules Still Pending' as issue_type,
    count(*) as count
FROM public.patient_schedules
WHERE scheduled_date < CURRENT_DATE 
AND status = 'scheduled';

-- 4. Backup Verification Queries
-- ==============================

-- Check last vacuum and analyze times
SELECT 
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check replication lag (if using replication)
-- SELECT 
--     client_addr,
--     client_hostname,
--     state,
--     sent_lsn,
--     write_lsn,
--     flush_lsn,
--     replay_lsn,
--     sync_state
-- FROM pg_stat_replication;

-- 5. Data Integrity Checks
-- ========================

-- Check for invalid foreign keys
SELECT 
    'Invalid nurse_id in schedules' as integrity_issue,
    count(*) as count
FROM public.patient_schedules ps
LEFT JOIN public.profiles p ON ps.nurse_id = p.id
WHERE ps.nurse_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 
    'Invalid created_by in schedules' as integrity_issue,
    count(*) as count
FROM public.patient_schedules ps
LEFT JOIN public.profiles p ON ps.created_by = p.id
WHERE ps.created_by IS NOT NULL AND p.id IS NULL;

-- Check for data consistency
SELECT 
    'Schedules without patient name' as consistency_issue,
    count(*) as count
FROM public.patient_schedules
WHERE patient_name IS NULL OR patient_name = '';

-- 6. Security Audit
-- =================

-- Check RLS policies are enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'patient_schedules', 'audit_logs');

-- Check for admin users
SELECT 
    name,
    email,
    department,
    created_at,
    is_active
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at;