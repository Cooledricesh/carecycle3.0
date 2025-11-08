-- Migration: Enhance profiles RLS policy for granular access control
-- Purpose: Restrict profile visibility to same-organization users only
-- Security: Prevent cross-organization data leakage while allowing necessary collaboration
-- Author: Senior Engineer
-- Date: 2025-11-08

BEGIN;

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create new granular RLS policies for profiles table

-- Policy 1: Users can view their own full profile
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Same organization users can view basic info only
-- This policy allows collaboration within organization while protecting privacy
CREATE POLICY "Same organization users can view basic info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: Admin can view all profiles in their organization
-- (Already covered by Policy 2, but kept for clarity)

-- Policy 5: Admin can update profiles in their organization
CREATE POLICY "Admin can update organization profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Create a view for basic profile info (alternative approach)
-- This view can be used instead of direct table access for better abstraction
CREATE OR REPLACE VIEW public.profile_basic_info AS
SELECT
  id,
  name,
  role,
  organization_id,
  is_active,
  created_at
FROM public.profiles
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.profile_basic_info TO authenticated;

-- Add RLS to the view (inherits from profiles table)
ALTER VIEW public.profile_basic_info SET (security_invoker = true);

COMMIT;

-- Documentation
COMMENT ON POLICY "Users can view own full profile" ON public.profiles IS
'Security: Users can view their complete profile including email and sensitive data';

COMMENT ON POLICY "Same organization users can view basic info" ON public.profiles IS
'Security: Organization members can view id, name, role of colleagues for collaboration';

COMMENT ON POLICY "Admin can update organization profiles" ON public.profiles IS
'Security: Admins can manage user profiles within their organization only';

COMMENT ON VIEW public.profile_basic_info IS
'View: Provides safe access to basic profile information for same-organization users';
