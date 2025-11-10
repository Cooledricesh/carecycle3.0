-- Migration: Allow users to view their own profile
-- Description: Users need to be able to query their own profile for role, organization_id, and care_type
-- Created: 2025-11-10
-- Issue: API routes fail with "사용자 정보를 확인할 수 없습니다" because users cannot SELECT their own profile

-- Create policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  id = auth.uid()
);

-- Add comment for documentation
COMMENT ON POLICY "Users can view own profile" ON profiles IS
'Allows authenticated users to view their own profile data. Required for API routes to check user role and organization.';
