-- Migration: Allow admins to view all profiles in their organization
-- Description: Admin users can view all user profiles within their organization
-- Created: 2025-11-08
-- Issue: Admin users could only see themselves and doctors, not nurses or other roles

-- Create policy: Admins can view all profiles in their organization
CREATE POLICY "Admin can view all organization profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Current user must be an admin
  EXISTS (
    SELECT 1
    FROM profiles AS admin_user
    WHERE admin_user.id = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
      AND admin_user.approval_status = 'approved'
      -- Target profile must be in the same organization as the admin
      AND admin_user.organization_id = profiles.organization_id
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Admin can view all organization profiles" ON profiles IS
'Allows admin users to view all user profiles within their organization for user management purposes';
