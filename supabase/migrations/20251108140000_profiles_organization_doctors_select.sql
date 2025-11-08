-- Migration: Allow users to view doctors in their organization
-- Description: Users in the same organization can view doctor profiles to select attending physicians
-- Created: 2025-01-08

-- Drop the policy if it already exists (for idempotency)
DROP POLICY IF EXISTS "profiles_organization_doctors_select" ON profiles;

-- Create policy: Users can view doctor profiles in their organization
-- This allows staff (admin, doctor, nurse) to see available doctors when assigning patients
CREATE POLICY "profiles_organization_doctors_select"
ON profiles
FOR SELECT
TO public
USING (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- Target profile must be a doctor
  role = 'doctor'
  AND
  -- Target doctor must be in the same organization as the current user
  organization_id IN (
    SELECT organization_id
    FROM profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
      AND is_active = true
  )
  AND
  -- Target doctor must be active and approved
  is_active = true
  AND
  approval_status = 'approved'
);

-- Add comment for documentation
COMMENT ON POLICY "profiles_organization_doctors_select" ON profiles IS
'Allows authenticated users to view doctor profiles within their organization for assigning attending physicians to patients';
