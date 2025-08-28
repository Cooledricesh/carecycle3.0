-- Update items table to use English categories
BEGIN;

-- First, update existing data from Korean to English
UPDATE items 
SET category = CASE 
    WHEN category = '주사' THEN 'injection'
    WHEN category = '검사' THEN 'test'
    WHEN category = '처치' THEN 'treatment'
    WHEN category = '기타' THEN 'other'
    ELSE category
END
WHERE category IN ('주사', '검사', '처치', '기타');

-- Drop the existing check constraint
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_category_check;

-- Add new check constraint with English categories
ALTER TABLE items 
ADD CONSTRAINT items_category_check 
CHECK (category IN ('injection', 'test', 'treatment', 'medication', 'other'));

-- Add comment to document the category values
COMMENT ON COLUMN items.category IS 'Category of the item: injection, test, treatment, medication, other';

COMMIT;