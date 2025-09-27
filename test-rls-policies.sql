-- Test script to check current RLS policies on patients table
-- and diagnose the issue with doctor_id updates

-- 1. Check all existing policies on patients table
SELECT
    pol.policyname,
    pol.polcmd as command,
    pol.polroles as roles,
    pol.polqual as using_expression,
    pol.polwithcheck as with_check_expression,
    pol.polpermissive as is_permissive
FROM pg_policies pol
WHERE pol.schemaname = 'public'
AND pol.tablename = 'patients'
ORDER BY pol.policyname;

-- 2. Check if is_user_active_and_approved function exists and what it returns
SELECT
    proname as function_name,
    prosrc as function_source
FROM pg_proc
WHERE proname = 'is_user_active_and_approved';

-- 3. Test the function for a specific user
-- Replace with actual user ID to test
-- SELECT is_user_active_and_approved();

-- 4. Check if there are multiple UPDATE policies that might conflict
SELECT COUNT(*) as update_policy_count,
       STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'patients'
AND polcmd = 'UPDATE';

-- 5. Check the actual column definition for doctor_id
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'patients'
AND column_name = 'doctor_id';

-- 6. Check if there are any CHECK constraints on the patients table
SELECT
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
AND rel.relname = 'patients'
AND con.contype = 'c';

-- 7. Check if there are any triggers on patients table that might interfere
SELECT
    tgname as trigger_name,
    tgtype,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'patients'::regclass
AND NOT tgisinternal;