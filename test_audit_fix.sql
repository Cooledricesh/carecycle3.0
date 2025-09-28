-- Test the corrected audit function by running the failed operation
-- This should now work without errors since we fixed the schema mismatch

-- First, let's see the current patients table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Now test the delete operation that was failing
-- We're using a test profile that should trigger the audit
-- DELETE FROM profiles WHERE id = '771c8278-7b15-41c6-9b3f-0b6a9345b91d';