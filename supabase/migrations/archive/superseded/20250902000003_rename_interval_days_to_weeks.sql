-- Rename interval_days to interval_weeks in schedules table
-- This migration updates the column name to match the application logic

-- Step 1: Add new interval_weeks column if it doesn't exist
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS interval_weeks INTEGER;

-- Step 2: Copy data from interval_days to interval_weeks (convert days to weeks)
-- Only update if interval_weeks is NULL and interval_days exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'schedules' 
        AND column_name = 'interval_days'
    ) THEN
        -- Copy the data, converting days to weeks (assuming data was already in weeks)
        -- Since the app was using weeks but storing in interval_days
        UPDATE schedules 
        SET interval_weeks = interval_days
        WHERE interval_weeks IS NULL;
    END IF;
END $$;

-- Step 3: Drop the old interval_days column if it exists
ALTER TABLE schedules 
DROP COLUMN IF EXISTS interval_days CASCADE;

-- Step 4: Add constraints to interval_weeks
ALTER TABLE schedules 
ALTER COLUMN interval_weeks SET NOT NULL,
ADD CONSTRAINT check_interval_weeks CHECK (interval_weeks > 0 AND interval_weeks <= 52);

-- Step 5: Update any CHECK constraints that reference interval_days
-- Drop old constraint if exists
ALTER TABLE schedules 
DROP CONSTRAINT IF EXISTS check_notification_interval;

-- Add new constraint with interval_weeks
ALTER TABLE schedules 
ADD CONSTRAINT check_notification_interval CHECK (
    (interval_weeks <= 1 AND requires_notification = false) OR
    interval_weeks > 1
);

-- Step 6: Create or update indexes
DROP INDEX IF EXISTS idx_schedules_interval;
CREATE INDEX idx_schedules_interval ON schedules(interval_weeks);

-- Step 7: Update the calculate_next_due_date function to use interval_weeks
-- (Already done in previous migration 20250902000001_fix_trigger_interval_weeks.sql)

-- Step 8: Add comment for documentation
COMMENT ON COLUMN schedules.interval_weeks IS 'Interval in weeks between scheduled executions';

-- Step 9: Verify the migration
DO $$
BEGIN
    -- Check that interval_weeks column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'schedules' 
        AND column_name = 'interval_weeks'
    ) THEN
        RAISE EXCEPTION 'Migration failed: interval_weeks column not created';
    END IF;
    
    -- Check that interval_days column no longer exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'schedules' 
        AND column_name = 'interval_days'
    ) THEN
        RAISE EXCEPTION 'Migration failed: interval_days column still exists';
    END IF;
    
    RAISE NOTICE 'Migration successful: interval_days renamed to interval_weeks';
END $$;