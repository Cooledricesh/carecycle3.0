-- Improve schedule_executions table to handle duplicate planned_date scenarios
-- This migration provides flexibility for handling completion date variations

BEGIN;

-- Option A: Keep existing constraint but add helper function for UPSERT operations
-- This preserves data integrity while allowing flexible completion handling

-- Create a function to handle schedule completion with UPSERT logic
CREATE OR REPLACE FUNCTION complete_schedule_execution(
    p_schedule_id UUID,
    p_planned_date DATE,
    p_executed_date DATE,
    p_executed_by UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    -- Use UPSERT to handle potential duplicates
    INSERT INTO schedule_executions (
        schedule_id,
        planned_date,
        executed_date,
        executed_time,
        status,
        executed_by,
        notes
    ) VALUES (
        p_schedule_id,
        p_planned_date,
        p_executed_date,
        CURRENT_TIME,
        'completed'::execution_status,
        p_executed_by,
        p_notes
    )
    ON CONFLICT (schedule_id, planned_date) 
    DO UPDATE SET
        executed_date = EXCLUDED.executed_date,
        executed_time = CURRENT_TIME,
        status = 'completed'::execution_status,
        executed_by = COALESCE(EXCLUDED.executed_by, schedule_executions.executed_by),
        notes = COALESCE(EXCLUDED.notes, schedule_executions.notes),
        updated_at = now()
    RETURNING id INTO v_execution_id;
    
    RETURN v_execution_id;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION complete_schedule_execution IS 'Safely completes a schedule execution using UPSERT logic to handle duplicate planned dates';

-- Create index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_schedule_executions_completion 
ON schedule_executions (schedule_id, planned_date, status)
WHERE status = 'completed';

-- Add a view for easier querying of completed executions
CREATE OR REPLACE VIEW completed_executions AS
SELECT 
    se.*,
    s.interval_weeks,
    s.next_due_date,
    extract(days from (se.executed_date - se.planned_date)) as days_variance
FROM schedule_executions se
JOIN schedules s ON se.schedule_id = s.id
WHERE se.status = 'completed'
ORDER BY se.executed_date DESC;

COMMENT ON VIEW completed_executions IS 'View of completed schedule executions with variance analysis';

COMMIT;