-- Add UPSERT function for schedule executions to handle duplicate entries gracefully
-- This prevents unique constraint violations when marking schedules as completed

-- Create a function to handle schedule completion with UPSERT logic
CREATE OR REPLACE FUNCTION complete_schedule_execution(
    p_schedule_id UUID,
    p_planned_date DATE,
    p_executed_date DATE,
    p_executed_by UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    -- Try to find existing execution record
    SELECT id INTO v_execution_id
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id 
    AND planned_date = p_planned_date;
    
    IF v_execution_id IS NOT NULL THEN
        -- Update existing record
        UPDATE schedule_executions
        SET 
            executed_date = p_executed_date,
            executed_time = CURRENT_TIME,
            status = 'completed'::execution_status,
            executed_by = p_executed_by,
            notes = COALESCE(p_notes, notes),
            updated_at = NOW()
        WHERE id = v_execution_id;
        
        RAISE NOTICE 'Updated existing execution record %', v_execution_id;
    ELSE
        -- Insert new record
        INSERT INTO schedule_executions (
            schedule_id,
            planned_date,
            executed_date,
            executed_time,
            status,
            executed_by,
            notes,
            created_at,
            updated_at
        ) VALUES (
            p_schedule_id,
            p_planned_date,
            p_executed_date,
            CURRENT_TIME,
            'completed'::execution_status,
            p_executed_by,
            p_notes,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created new execution record';
    END IF;
    
    -- The trigger will automatically handle next_due_date calculation
END;
$$;

-- Add helper function to get or create execution record
CREATE OR REPLACE FUNCTION get_or_create_execution(
    p_schedule_id UUID,
    p_planned_date DATE
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    -- Try to find existing execution
    SELECT id INTO v_execution_id
    FROM schedule_executions
    WHERE schedule_id = p_schedule_id 
    AND planned_date = p_planned_date;
    
    -- If not found, create a new one
    IF v_execution_id IS NULL THEN
        INSERT INTO schedule_executions (
            schedule_id,
            planned_date,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_schedule_id,
            p_planned_date,
            'planned'::execution_status,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_execution_id;
    END IF;
    
    RETURN v_execution_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION complete_schedule_execution TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_execution TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION complete_schedule_execution IS 
'Safely completes a schedule execution using UPSERT logic to prevent duplicate key violations.
This function should be used instead of direct INSERT to handle cases where the same 
planned_date might be processed multiple times.';

COMMENT ON FUNCTION get_or_create_execution IS 
'Gets an existing execution record or creates a new one if it doesn''t exist.
Useful for ensuring an execution record exists before updating it.';