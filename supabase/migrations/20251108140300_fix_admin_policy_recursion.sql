-- Migration: Fix RLS recursion in admin policy
-- Description: Create helper function to check if user is admin without RLS recursion
-- Created: 2025-11-08
-- Issue: Previous policy caused RLS recursion when querying profiles table within the policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admin can view all organization profiles" ON profiles;

-- Create helper function to check if current user is an admin
-- SECURITY DEFINER allows bypassing RLS within the function
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
      AND approval_status = 'approved'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- Recreate policy using the helper function to avoid recursion
CREATE POLICY "Admin can view all organization profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Admin can see all profiles in their organization
  is_user_admin()
  AND
  organization_id = get_user_organization_id()
);

-- Add comment for documentation
COMMENT ON FUNCTION is_user_admin() IS
'Returns true if the currently authenticated user is an active, approved admin. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

COMMENT ON POLICY "Admin can view all organization profiles" ON profiles IS
'Allows admin users to view all user profiles within their organization for user management purposes. Uses helper functions to prevent RLS recursion.';
