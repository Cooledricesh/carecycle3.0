-- Convert items table from days to weeks
BEGIN;

-- Add new column for weeks
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS default_interval_weeks INTEGER;

-- Convert existing days to weeks (divide by 7)
UPDATE items 
SET default_interval_weeks = CASE 
    WHEN default_interval_days IS NOT NULL THEN CEIL(default_interval_days::numeric / 7)::integer
    ELSE NULL
END;

-- Drop the old days column
ALTER TABLE items 
DROP COLUMN IF EXISTS default_interval_days;

-- Remove old constraint if exists
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_default_interval_days_check;

-- Add new constraint for weeks
ALTER TABLE items 
ADD CONSTRAINT items_default_interval_weeks_check 
CHECK (default_interval_weeks IS NULL OR default_interval_weeks > 0);

-- Update column comment
COMMENT ON COLUMN items.default_interval_weeks IS 'Default interval in weeks for the item';

COMMIT;