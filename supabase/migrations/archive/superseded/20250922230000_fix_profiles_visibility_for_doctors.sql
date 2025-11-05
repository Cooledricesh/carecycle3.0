-- Fix profiles visibility so all users can see doctor names
-- Problem: Patients showing "미지정" for other doctors because RLS blocks viewing other profiles
-- Solution: Allow all authenticated users to view all profiles (read-only)

BEGIN;

-- Drop the restrictive select policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_secure_select" ON profiles;

-- Create a new policy that allows all authenticated users to view all profiles
-- This is necessary for showing doctor names in patient lists
CREATE POLICY "all_users_can_view_profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Keep the existing update/delete policies for security
-- Users can still only update their own profile
-- Only admins can delete profiles

COMMENT ON POLICY "all_users_can_view_profiles" ON profiles IS
'Allows all authenticated users to view all profiles. This is necessary for displaying doctor names in patient lists and other UI elements where user names need to be shown.';

COMMIT;