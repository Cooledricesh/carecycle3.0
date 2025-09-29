-- Simplify ItemCategory enum to only have 'injection', 'test', 'other'
-- This migration updates existing data and modifies the enum type

BEGIN;

-- First, update any existing 'treatment' or 'medication' values to 'other'
UPDATE items
SET category = 'other'
WHERE category IN ('treatment', 'medication');

-- Create a temporary enum type with the new values
CREATE TYPE item_category_new AS ENUM ('injection', 'test', 'other');

-- Update all columns using the old enum to use the new enum
ALTER TABLE items
  ALTER COLUMN category TYPE item_category_new
  USING category::text::item_category_new;

-- Drop the old enum type
DROP TYPE IF EXISTS item_category;

-- Rename the new enum type to the original name
ALTER TYPE item_category_new RENAME TO item_category;

-- Add comment for documentation
COMMENT ON TYPE item_category IS 'Simplified item categories: injection (주사), test (검사), other (기타)';

COMMIT;