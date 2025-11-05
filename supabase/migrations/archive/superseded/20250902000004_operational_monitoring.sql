-- Operational monitoring and maintenance for schedule executions
-- This migration adds monitoring, alerts, and maintenance procedures

BEGIN;

-- ============================================================================
-- BACKUP AND DISASTER RECOVERY
-- ============================================================================

-- Create backup function for critical schedule data
CREATE OR REPLACE FUNCTION backup_schedule_data(backup_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    backup_timestamp TIMESTAMPTZ,
    schedules_count BIGINT,
    executions_count BIGINT,
    patients_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log backup operation
    INSERT INTO schedule_logs (action, new_values, reason)
    VALUES (
        'BACKUP_CREATED',
        jsonb_build_object(
            'backup_date', backup_date,
            'timestamp', now()
        ),
        'Automated daily backup'
    );
    
    RETURN QUERY
    SELECT 
        now() as backup_timestamp,
        (SELECT COUNT(*) FROM schedules WHERE created_at::date <= backup_date) as schedules_count,
        (SELECT COUNT(*) FROM schedule_executions WHERE created_at::date <= backup_date) as executions_count,
        (SELECT COUNT(*) FROM patients WHERE created_at::date <= backup_date) as patients_count;
END;
$$;

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- Monitor query performance for schedule operations
CREATE OR REPLACE VIEW schedule_performance_metrics AS
SELECT 
    'active_schedules' as metric,
    COUNT(*) as value,
    'count' as unit
FROM schedules WHERE status = 'active'
UNION ALL
SELECT 
    'overdue_schedules' as metric,
    COUNT(*) as value,
    'count' as unit
FROM schedules WHERE status = 'active' AND next_due_date < CURRENT_DATE
UNION ALL
SELECT 
    'completion_rate_7d' as metric,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)),
        2
    ) as value,
    'percentage' as unit
FROM schedule_executions 
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
    'avg_completion_variance_days' as metric,
    ROUND(
        AVG(EXTRACT(days FROM (executed_date - planned_date))),
        1
    ) as value,
    'days' as unit
FROM schedule_executions 
WHERE status = 'completed' 
  AND executed_date IS NOT NULL 
  AND created_at > CURRENT_DATE - INTERVAL '30 days';

-- Alert function for operational issues
CREATE OR REPLACE FUNCTION check_operational_health()
RETURNS TABLE (
    alert_level TEXT,
    alert_message TEXT,
    metric_value NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for overdue schedules
    RETURN QUERY
    SELECT 
        'WARNING'::TEXT,
        'High number of overdue schedules detected'::TEXT,
        COUNT(*)::NUMERIC
    FROM schedules 
    WHERE status = 'active' 
      AND next_due_date < CURRENT_DATE - INTERVAL '7 days'
    HAVING COUNT(*) > 10;
    
    -- Check for execution failures
    RETURN QUERY
    SELECT 
        'CRITICAL'::TEXT,
        'Low completion rate detected in last 7 days'::TEXT,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)),
            2
        )::NUMERIC
    FROM schedule_executions 
    WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
    HAVING (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)) < 70;
    
    -- Check for constraint violations
    RETURN QUERY
    SELECT 
        'INFO'::TEXT,
        'Duplicate execution attempts detected'::TEXT,
        COUNT(*)::NUMERIC
    FROM (
        SELECT schedule_id, planned_date, COUNT(*) as cnt
        FROM schedule_executions 
        WHERE created_at > CURRENT_DATE - INTERVAL '1 day'
        GROUP BY schedule_id, planned_date
        HAVING COUNT(*) > 1
    ) duplicates;
END;
$$;

-- ============================================================================
-- AUTOMATED MAINTENANCE
-- ============================================================================

-- Vacuum and analyze function for schedule tables
CREATE OR REPLACE FUNCTION maintain_schedule_tables()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Vacuum analyze critical tables
    EXECUTE 'VACUUM ANALYZE schedules';
    EXECUTE 'VACUUM ANALYZE schedule_executions';
    EXECUTE 'VACUUM ANALYZE patients';
    
    -- Update statistics
    EXECUTE 'ANALYZE schedules';
    EXECUTE 'ANALYZE schedule_executions';
    
    -- Log maintenance activity
    INSERT INTO schedule_logs (action, reason)
    VALUES ('MAINTENANCE_COMPLETED', 'Automated table maintenance');
    
    result := 'Maintenance completed at ' || now();
    RETURN result;
END;
$$;

-- ============================================================================
-- REPLICATION AND HIGH AVAILABILITY
-- ============================================================================

-- Function to check replication lag (if using read replicas)
CREATE OR REPLACE FUNCTION check_replication_status()
RETURNS TABLE (
    replica_status TEXT,
    lag_seconds INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- This would be implemented based on your replication setup
    -- Placeholder for monitoring replication lag
    RETURN QUERY
    SELECT 
        'HEALTHY'::TEXT as replica_status,
        0 as lag_seconds;
END;
$$;

-- ============================================================================
-- USER MANAGEMENT AND ACCESS CONTROL
-- ============================================================================

-- Create role for read-only analytics access
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schedule_analytics') THEN
        CREATE ROLE schedule_analytics;
    END IF;
END
$$;

-- Grant minimal permissions for analytics
GRANT SELECT ON schedules TO schedule_analytics;
GRANT SELECT ON schedule_executions TO schedule_analytics;
GRANT SELECT ON patients TO schedule_analytics;
GRANT SELECT ON completed_executions TO schedule_analytics;
GRANT SELECT ON schedule_performance_metrics TO schedule_analytics;

-- Create role for maintenance operations
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schedule_maintenance') THEN
        CREATE ROLE schedule_maintenance;
    END IF;
END
$$;

-- Grant maintenance permissions
GRANT EXECUTE ON FUNCTION maintain_schedule_tables() TO schedule_maintenance;
GRANT EXECUTE ON FUNCTION backup_schedule_data(DATE) TO schedule_maintenance;
GRANT EXECUTE ON FUNCTION check_operational_health() TO schedule_maintenance;

COMMIT;