-- Migration: Add Schedule History Support for Calendar View
-- Created: 2025-12-25
-- Purpose: Enable viewing completed schedule history in calendar while maintaining data integrity

BEGIN;

-- =====================================================
-- 1. Performance Indexes for Calendar Queries
-- =====================================================

-- Index for efficient execution history queries in calendar view
CREATE INDEX IF NOT EXISTS idx_executions_for_calendar
ON schedule_executions(executed_date, schedule_id, status)
WHERE status = 'completed';

-- Composite index for calendar date range queries
CREATE INDEX IF NOT EXISTS idx_executions_calendar_range
ON schedule_executions(executed_date, schedule_id)
INCLUDE (executed_by, notes)
WHERE status = 'completed';

-- Index for joining with schedules table
CREATE INDEX IF NOT EXISTS idx_executions_schedule_join
ON schedule_executions(schedule_id, executed_date DESC)
WHERE status = 'completed';

-- =====================================================
-- 2. Database Function for Calendar Queries
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_calendar_schedules(DATE, DATE, UUID);

-- Create optimized function for calendar schedule retrieval
CREATE OR REPLACE FUNCTION get_calendar_schedules(
    p_start_date DATE,
    p_end_date DATE,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    schedule_id UUID,
    patient_id UUID,
    item_id UUID,
    display_date DATE,
    display_type TEXT,
    schedule_status TEXT,
    execution_id UUID,
    executed_by UUID,
    execution_notes TEXT,
    patient_name TEXT,
    item_name TEXT,
    item_category TEXT,
    interval_weeks INTEGER,
    priority INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Future/current schedules from schedules table
    SELECT
        s.id as schedule_id,
        s.patient_id,
        s.item_id,
        s.next_due_date as display_date,
        'scheduled'::TEXT as display_type,
        s.status::TEXT as schedule_status,
        NULL::UUID as execution_id,
        s.assigned_nurse_id as executed_by,
        s.notes as execution_notes,
        p.name as patient_name,
        i.name as item_name,
        i.category as item_category,
        s.interval_weeks,
        s.priority
    FROM schedules s
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    WHERE s.next_due_date BETWEEN p_start_date AND p_end_date
    AND s.status IN ('active', 'paused')
    AND (p_user_id IS NULL OR
         -- Role-based filtering can be added here if needed
         EXISTS (
            SELECT 1 FROM profiles pr
            WHERE pr.id = p_user_id
            AND pr.is_active = true
            AND pr.approval_status = 'approved'
         ))

    UNION ALL

    -- Historical completed executions
    SELECT
        se.schedule_id,
        s.patient_id,
        s.item_id,
        se.executed_date as display_date,
        'completed'::TEXT as display_type,
        'completed'::TEXT as schedule_status,
        se.id as execution_id,
        se.executed_by,
        se.notes as execution_notes,
        p.name as patient_name,
        i.name as item_name,
        i.category as item_category,
        s.interval_weeks,
        s.priority
    FROM schedule_executions se
    JOIN schedules s ON se.schedule_id = s.id
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    WHERE se.executed_date BETWEEN p_start_date AND p_end_date
    AND se.status = 'completed'
    AND (p_user_id IS NULL OR
         EXISTS (
            SELECT 1 FROM profiles pr
            WHERE pr.id = p_user_id
            AND pr.is_active = true
            AND pr.approval_status = 'approved'
         ))

    ORDER BY display_date, priority DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_calendar_schedules(DATE, DATE, UUID) TO authenticated;

-- =====================================================
-- 3. Helper Function for Schedule Statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_schedule_statistics(
    p_schedule_id UUID
)
RETURNS TABLE (
    total_executions BIGINT,
    completed_count BIGINT,
    skipped_count BIGINT,
    first_execution_date DATE,
    last_execution_date DATE,
    completion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT as completed_count,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END)::BIGINT as skipped_count,
        MIN(executed_date)::DATE as first_execution_date,
        MAX(executed_date)::DATE as last_execution_date,
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
            ELSE 0
        END as completion_rate
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id
    AND status IN ('completed', 'skipped');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_schedule_statistics(UUID) TO authenticated;

-- =====================================================
-- 4. Add Constraint for Data Integrity
-- =====================================================

-- Ensure executed_date is set when status is completed
ALTER TABLE schedule_executions
DROP CONSTRAINT IF EXISTS check_execution_completion;

ALTER TABLE schedule_executions
ADD CONSTRAINT check_execution_completion
CHECK (
    (status = 'completed' AND executed_date IS NOT NULL) OR
    (status != 'completed')
);

-- =====================================================
-- 5. Create View for Monthly Calendar Summary
-- =====================================================

CREATE OR REPLACE VIEW calendar_monthly_summary AS
SELECT
    date_trunc('month', COALESCE(s.next_due_date, se.executed_date))::DATE as month,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_schedules,
    COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'completed') as completed_executions,
    COUNT(DISTINCT s.patient_id) as unique_patients,
    COUNT(DISTINCT s.item_id) as unique_items
FROM schedules s
LEFT JOIN schedule_executions se ON s.id = se.schedule_id
WHERE s.status IN ('active', 'paused', 'completed')
GROUP BY 1;

-- Grant select permission
GRANT SELECT ON calendar_monthly_summary TO authenticated;

-- =====================================================
-- 6. Performance Optimization for Existing Indexes
-- =====================================================

-- Analyze tables to update statistics for query planner
ANALYZE schedules;
ANALYZE schedule_executions;
ANALYZE patients;
ANALYZE items;

-- =====================================================
-- 7. Add Comment Documentation
-- =====================================================

COMMENT ON FUNCTION get_calendar_schedules IS 'Retrieves both scheduled and completed schedule records for calendar display';
COMMENT ON FUNCTION get_schedule_statistics IS 'Provides execution statistics for a specific schedule';
COMMENT ON INDEX idx_executions_for_calendar IS 'Optimizes calendar view queries for completed executions';
COMMENT ON INDEX idx_executions_calendar_range IS 'Supports date range queries with included columns for covering index';
COMMENT ON VIEW calendar_monthly_summary IS 'Provides monthly summary statistics for calendar view';

COMMIT;

-- =====================================================
-- Migration Rollback Script (if needed)
-- =====================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS get_calendar_schedules(DATE, DATE, UUID);
-- DROP FUNCTION IF EXISTS get_schedule_statistics(UUID);
-- DROP INDEX IF EXISTS idx_executions_for_calendar;
-- DROP INDEX IF EXISTS idx_executions_calendar_range;
-- DROP INDEX IF EXISTS idx_executions_schedule_join;
-- DROP VIEW IF EXISTS calendar_monthly_summary;
-- ALTER TABLE schedule_executions DROP CONSTRAINT IF EXISTS check_execution_completion;
-- COMMIT;