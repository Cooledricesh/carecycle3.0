-- Migration: Fix infinite recursion in profiles RLS policy
-- Description: Create a helper function to get user's organization_id without RLS recursion
-- Created: 2025-01-08

-- Drop the problematic policy first
DROP POLICY IF EXISTS "profiles_organization_doctors_select" ON profiles;

-- Create helper function to get current user's organization_id
-- SECURITY DEFINER allows bypassing RLS within the function
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND approval_status = 'approved'
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;

-- Recreate policy using the helper function
CREATE POLICY "profiles_organization_doctors_select"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Target profile must be a doctor
  role = 'doctor'
  AND
  -- Target doctor must be in the same organization as the current user
  organization_id = get_user_organization_id()
  AND
  -- Target doctor must be active and approved
  is_active = true
  AND
  approval_status = 'approved'
);

-- Add comment for documentation
COMMENT ON FUNCTION get_user_organization_id() IS
'Returns the organization_id of the currently authenticated user. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

COMMENT ON POLICY "profiles_organization_doctors_select" ON profiles IS
'Allows authenticated users to view doctor profiles within their organization for assigning attending physicians to patients. Uses helper function to prevent RLS recursion.';
