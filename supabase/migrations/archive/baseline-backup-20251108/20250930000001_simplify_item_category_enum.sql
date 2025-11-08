-- Simplify item_category by removing unused categories (treatment, medication)
-- This migration is safe because:
-- 1. No existing data uses 'treatment' or 'medication' categories
-- 2. Code already only uses 'injection', 'test', and 'other'

BEGIN;

-- First, verify that no items use the categories we're removing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM items
    WHERE category IN ('treatment', 'medication')
  ) THEN
    RAISE EXCEPTION 'Cannot remove categories: items with treatment or medication categories still exist';
  END IF;
END $$;

-- For extra safety, update any unexpected values to 'other'
-- This handles any edge cases like typos or undefined values
UPDATE items
SET category = 'other'
WHERE category IS NOT NULL
  AND category NOT IN ('injection', 'test', 'other');

-- Drop the existing constraint
ALTER TABLE items
DROP CONSTRAINT IF EXISTS items_category_check;

-- Add the new simplified constraint with only actively used categories
ALTER TABLE items
ADD CONSTRAINT items_category_check
CHECK (category IN ('injection', 'test', 'other'));

-- Update the column comment to reflect the simplified categories
COMMENT ON COLUMN items.category IS 'Category of the item: injection (주사), test (검사), other (기타)';

COMMIT;