-- Alternative constraint strategy for schedule_executions
-- This migration is OPTIONAL - choose between this and the UPSERT approach

-- UNCOMMENT THE APPROACH YOU PREFER:

BEGIN;

-- ============================================================================
-- OPTION 1: Change constraint to allow multiple executions per planned date
-- ============================================================================
/*
-- Drop the existing unique constraint
ALTER TABLE schedule_executions 
DROP CONSTRAINT IF EXISTS unique_schedule_date;

-- Add new constraint: unique on (schedule_id, planned_date, executed_date)
-- This allows multiple attempts but prevents exact duplicates
ALTER TABLE schedule_executions 
ADD CONSTRAINT unique_schedule_execution 
UNIQUE (schedule_id, planned_date, executed_date);

-- Add partial unique index for active planned executions
CREATE UNIQUE INDEX unique_planned_execution 
ON schedule_executions (schedule_id, planned_date) 
WHERE status = 'planned';

COMMENT ON CONSTRAINT unique_schedule_execution ON schedule_executions IS 
'Prevents duplicate executions for same schedule/planned_date/executed_date combination';
*/

-- ============================================================================
-- OPTION 2: Soft delete approach - mark as superseded instead of duplicate
-- ============================================================================
/*
-- Add superseded status and reference to original
ALTER TABLE schedule_executions 
ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES schedule_executions(id);

-- Function to handle completion with superseding logic
CREATE OR REPLACE FUNCTION complete_schedule_with_supersede(
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
    v_existing_id UUID;
    v_new_id UUID;
BEGIN
    -- Check if execution already exists
    SELECT id INTO v_existing_id 
    FROM schedule_executions 
    WHERE schedule_id = p_schedule_id 
      AND planned_date = p_planned_date 
      AND NOT is_superseded;
    
    IF v_existing_id IS NOT NULL THEN
        -- Mark existing as superseded
        UPDATE schedule_executions 
        SET is_superseded = TRUE 
        WHERE id = v_existing_id;
    END IF;
    
    -- Create new execution record
    INSERT INTO schedule_executions (
        schedule_id, planned_date, executed_date, 
        executed_time, status, executed_by, notes
    ) VALUES (
        p_schedule_id, p_planned_date, p_executed_date,
        CURRENT_TIME, 'completed'::execution_status, p_executed_by, p_notes
    ) RETURNING id INTO v_new_id;
    
    -- Link superseded record if exists
    IF v_existing_id IS NOT NULL THEN
        UPDATE schedule_executions 
        SET superseded_by = v_new_id 
        WHERE id = v_existing_id;
    END IF;
    
    RETURN v_new_id;
END;
$$;
*/

-- ============================================================================
-- OPTION 3: Execution sequence approach
-- ============================================================================
/*
-- Add execution sequence number
ALTER TABLE schedule_executions 
ADD COLUMN IF NOT EXISTS execution_sequence INTEGER DEFAULT 1;

-- Drop existing constraint
ALTER TABLE schedule_executions 
DROP CONSTRAINT IF EXISTS unique_schedule_date;

-- Add new composite constraint
ALTER TABLE schedule_executions 
ADD CONSTRAINT unique_schedule_execution_sequence 
UNIQUE (schedule_id, planned_date, execution_sequence);

-- Function to get next sequence number
CREATE OR REPLACE FUNCTION get_next_execution_sequence(
    p_schedule_id UUID,
    p_planned_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(execution_sequence), 0) + 1 
    INTO v_next_seq
    FROM schedule_executions 
    WHERE schedule_id = p_schedule_id 
      AND planned_date = p_planned_date;
    
    RETURN v_next_seq;
END;
$$;
*/

-- For now, we'll use the UPSERT approach from the previous migration
-- This comment serves as documentation for alternative approaches

COMMIT;