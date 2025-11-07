-- Fix circular dependency in RLS policies
-- The previous policy created a circular reference where profiles table RLS
-- called auth.get_current_user_organization_id() which queries profiles table
-- This creates a deadlock preventing profile queries from completing

BEGIN;

-- Drop the problematic policy that causes circular reference
DROP POLICY IF EXISTS "profiles_org_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_delete" ON public.profiles;

-- Create new policies that avoid circular reference
-- 1. Users can always see their own profile
CREATE POLICY "profiles_own_select"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- 2. Admins can see profiles in their organization
-- This avoids calling get_current_user_organization_id() function
CREATE POLICY "profiles_org_admin_select"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid()
            AND admin_profile.role = 'admin'
            AND admin_profile.organization_id = profiles.organization_id
            AND admin_profile.approval_status = 'approved'
            AND admin_profile.is_active = true
        )
    );

-- 3. Users can insert their own profile
CREATE POLICY "profiles_own_insert"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- 4. Users can update their own profile
CREATE POLICY "profiles_own_update"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 5. Admins can update profiles in their organization
CREATE POLICY "profiles_org_admin_update"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid()
            AND admin_profile.role = 'admin'
            AND admin_profile.organization_id = profiles.organization_id
            AND admin_profile.approval_status = 'approved'
            AND admin_profile.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid()
            AND admin_profile.role = 'admin'
            AND admin_profile.organization_id = profiles.organization_id
            AND admin_profile.approval_status = 'approved'
            AND admin_profile.is_active = true
        )
    );

-- 6. Only super admins can delete profiles
CREATE POLICY "profiles_super_admin_delete"
    ON public.profiles FOR DELETE
    USING (false); -- Effectively disable deletes through normal operations

-- Fix the get_current_user_organization_id function to handle the initial query better
-- Add SECURITY DEFINER to bypass RLS for this specific function
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
STABLE
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Get the organization_id for the current user
    -- Using SECURITY DEFINER means this query bypasses RLS policies
    SELECT organization_id INTO org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    RETURN org_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_current_user_organization_id() TO authenticated;

COMMIT;
