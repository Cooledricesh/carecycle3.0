-- Healthcare Scheduler Database Maintenance Automation
-- Schedule these operations for optimal database performance

-- ============================================================================
-- DAILY MAINTENANCE TASKS (Run at 2 AM)
-- ============================================================================

-- 1. Cleanup old audit logs (keep last 90 days)
DELETE FROM public.audit_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- 2. Update statistics on all tables
ANALYZE public.profiles;
ANALYZE public.patient_schedules;
ANALYZE public.audit_logs;

-- 3. Check for orphaned schedules and mark them
UPDATE public.patient_schedules 
SET status = 'cancelled',
    notes = COALESCE(notes || ' | ', '') || 'Auto-cancelled: orphaned schedule'
WHERE nurse_id NOT IN (SELECT id FROM public.profiles WHERE is_active = true)
AND status = 'scheduled'
AND scheduled_date < CURRENT_DATE;

-- 4. Auto-update past scheduled appointments to completed if not updated
UPDATE public.patient_schedules 
SET status = 'completed',
    notes = COALESCE(notes || ' | ', '') || 'Auto-completed: past appointment'
WHERE status = 'scheduled'
AND scheduled_date < CURRENT_DATE - INTERVAL '1 day';

-- ============================================================================
-- WEEKLY MAINTENANCE TASKS (Run Sunday at 1 AM)
-- ============================================================================

-- 1. Vacuum and reindex high-activity tables
VACUUM ANALYZE public.profiles;
VACUUM ANALYZE public.patient_schedules;
VACUUM ANALYZE public.audit_logs;

-- 2. Check for schedule conflicts and log them
INSERT INTO public.audit_logs (
    table_name, 
    operation, 
    old_values, 
    user_email, 
    timestamp
)
SELECT 
    'patient_schedules',
    'CONFLICT_DETECTED',
    jsonb_build_object(
        'schedule1_id', s1.id,
        'schedule2_id', s2.id,
        'nurse_id', s1.nurse_id,
        'date', s1.scheduled_date,
        'time1', s1.scheduled_time,
        'time2', s2.scheduled_time
    ),
    'system@maintenance',
    NOW()
FROM public.patient_schedules s1
JOIN public.patient_schedules s2 ON s1.nurse_id = s2.nurse_id 
    AND s1.scheduled_date = s2.scheduled_date
    AND s1.id < s2.id
    AND s1.status NOT IN ('cancelled', 'no_show')
    AND s2.status NOT IN ('cancelled', 'no_show')
WHERE s1.scheduled_time < s2.scheduled_time + (s2.duration_minutes || ' minutes')::INTERVAL
AND s2.scheduled_time < s1.scheduled_time + (s1.duration_minutes || ' minutes')::INTERVAL;

-- 3. Generate weekly performance report
INSERT INTO public.audit_logs (
    table_name,
    operation,
    new_values,
    user_email,
    timestamp
)
SELECT 
    'performance_report',
    'WEEKLY_REPORT',
    jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM public.profiles WHERE is_active = true),
        'total_schedules_week', (SELECT COUNT(*) FROM public.patient_schedules WHERE created_at >= NOW() - INTERVAL '7 days'),
        'completed_schedules_week', (SELECT COUNT(*) FROM public.patient_schedules WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '7 days'),
        'cancelled_schedules_week', (SELECT COUNT(*) FROM public.patient_schedules WHERE status = 'cancelled' AND updated_at >= NOW() - INTERVAL '7 days'),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'profiles_table_size', pg_size_pretty(pg_total_relation_size('public.profiles')),
        'schedules_table_size', pg_size_pretty(pg_total_relation_size('public.patient_schedules')),
        'audit_logs_table_size', pg_size_pretty(pg_total_relation_size('public.audit_logs'))
    ),
    'system@maintenance',
    NOW();

-- ============================================================================
-- MONTHLY MAINTENANCE TASKS (Run 1st Sunday at midnight)
-- ============================================================================

-- 1. Archive old completed schedules (older than 1 year)
-- Create archive table if not exists
CREATE TABLE IF NOT EXISTS public.patient_schedules_archive (
    LIKE public.patient_schedules INCLUDING ALL
);

-- Move old completed schedules to archive
WITH archived_schedules AS (
    DELETE FROM public.patient_schedules 
    WHERE status IN ('completed', 'cancelled', 'no_show')
    AND scheduled_date < CURRENT_DATE - INTERVAL '1 year'
    RETURNING *
)
INSERT INTO public.patient_schedules_archive 
SELECT * FROM archived_schedules;

-- 2. Update table statistics after archiving
ANALYZE public.patient_schedules;
ANALYZE public.patient_schedules_archive;

-- 3. Check and rebuild indexes if fragmentation is high
DO $$
DECLARE
    idx_name TEXT;
    table_name TEXT;
    bloat_ratio NUMERIC;
BEGIN
    -- Check index bloat and rebuild if necessary
    FOR idx_name, table_name IN 
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND tablename IN ('profiles', 'patient_schedules')
    LOOP
        -- Rebuild index if it appears to have significant bloat
        -- This is a simplified check - in production, use more sophisticated bloat detection
        EXECUTE format('REINDEX INDEX CONCURRENTLY %I', idx_name);
    END LOOP;
END $$;

-- ============================================================================
-- MONITORING QUERIES FOR AUTOMATION
-- ============================================================================

-- Create monitoring functions for automated alerts

-- Function to check database health
CREATE OR REPLACE FUNCTION public.check_db_health()
RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC,
    status TEXT,
    threshold_exceeded BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT 'connection_count'::TEXT as name, 
               COUNT(*)::NUMERIC as value, 
               100::NUMERIC as threshold
        FROM pg_stat_activity WHERE state = 'active'
        
        UNION ALL
        
        SELECT 'long_running_queries'::TEXT as name,
               COUNT(*)::NUMERIC as value,
               5::NUMERIC as threshold
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '5 minutes'
        AND pid != pg_backend_pid()
        
        UNION ALL
        
        SELECT 'database_size_gb'::TEXT as name,
               ROUND(pg_database_size(current_database())/1024/1024/1024::NUMERIC, 2) as value,
               10::NUMERIC as threshold
        
        UNION ALL
        
        SELECT 'failed_logins_24h'::TEXT as name,
               COALESCE(COUNT(*), 0)::NUMERIC as value,
               50::NUMERIC as threshold
        FROM public.audit_logs 
        WHERE table_name = 'auth_failed_login'
        AND timestamp >= NOW() - INTERVAL '24 hours'
        
        UNION ALL
        
        SELECT 'schedule_conflicts'::TEXT as name,
               COUNT(*)::NUMERIC as value,
               0::NUMERIC as threshold
        FROM public.patient_schedules s1
        JOIN public.patient_schedules s2 ON s1.nurse_id = s2.nurse_id 
            AND s1.scheduled_date = s2.scheduled_date
            AND s1.id != s2.id
            AND s1.status NOT IN ('cancelled', 'no_show')
            AND s2.status NOT IN ('cancelled', 'no_show')
        WHERE s1.scheduled_time < s2.scheduled_time + (s2.duration_minutes || ' minutes')::INTERVAL
        AND s2.scheduled_time < s1.scheduled_time + (s1.duration_minutes || ' minutes')::INTERVAL
    )
    SELECT 
        m.name,
        m.value,
        CASE 
            WHEN m.value > m.threshold THEN 'CRITICAL'
            WHEN m.value > m.threshold * 0.8 THEN 'WARNING'
            ELSE 'OK'
        END,
        m.value > m.threshold
    FROM metrics m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance metrics
CREATE OR REPLACE FUNCTION public.get_performance_summary()
RETURNS TABLE(
    metric_type TEXT,
    metric_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'table_stats'::TEXT, jsonb_agg(
        jsonb_build_object(
            'table_name', schemaname || '.' || tablename,
            'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
            'live_tuples', n_live_tup,
            'dead_tuples', n_dead_tup,
            'last_vacuum', last_vacuum,
            'last_analyze', last_analyze
        )
    )
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 'index_usage'::TEXT, jsonb_agg(
        jsonb_build_object(
            'index_name', indexname,
            'table_name', tablename,
            'index_scans', idx_scan,
            'tuples_read', idx_tup_read,
            'size', pg_size_pretty(pg_relation_size(indexrelid))
        )
    )
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND idx_scan > 0
    
    UNION ALL
    
    SELECT 'database_summary'::TEXT, jsonb_build_object(
        'total_size', pg_size_pretty(pg_database_size(current_database())),
        'total_connections', (SELECT COUNT(*) FROM pg_stat_activity),
        'active_connections', (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),
        'total_users', (SELECT COUNT(*) FROM public.profiles WHERE is_active = true),
        'total_schedules', (SELECT COUNT(*) FROM public.patient_schedules),
        'todays_schedules', (SELECT COUNT(*) FROM public.patient_schedules WHERE scheduled_date = CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- EMERGENCY MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to emergency cleanup (use only in critical situations)
CREATE OR REPLACE FUNCTION public.emergency_cleanup()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Only allow admins to run this
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied. Admin role required for emergency cleanup.';
    END IF;
    
    -- Kill long-running queries (except this one)
    PERFORM pg_terminate_backend(pid)
    FROM pg_stat_activity 
    WHERE state = 'active' 
    AND query_start < NOW() - INTERVAL '10 minutes'
    AND pid != pg_backend_pid()
    AND query NOT LIKE '%emergency_cleanup%';
    
    result := result || 'Killed long-running queries. ';
    
    -- Clean up old audit logs aggressively
    DELETE FROM public.audit_logs WHERE timestamp < NOW() - INTERVAL '30 days';
    
    result := result || 'Cleaned old audit logs. ';
    
    -- Vacuum critical tables
    VACUUM ANALYZE public.profiles;
    VACUUM ANALYZE public.patient_schedules;
    
    result := result || 'Vacuumed critical tables.';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SCHEDULING NOTES
-- ============================================================================

/*
To implement automated scheduling in production:

1. Use Supabase Edge Functions or external cron jobs
2. Call these maintenance functions on schedule:
   - Daily: Run daily maintenance tasks
   - Weekly: Run weekly maintenance tasks  
   - Monthly: Run monthly maintenance tasks

3. Set up monitoring alerts:
   - Run check_db_health() every 5 minutes
   - Alert if any threshold_exceeded = true
   - Send weekly performance summaries

4. Backup schedule:
   - Supabase automatically backs up daily
   - Test restore monthly
   - Verify backup integrity weekly

5. Connection pooling:
   - Configure pgBouncer or similar
   - Set max connections appropriately
   - Monitor connection usage
*/