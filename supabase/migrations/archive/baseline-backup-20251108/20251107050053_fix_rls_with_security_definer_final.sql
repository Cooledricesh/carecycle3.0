-- Final fix for infinite recursion in RLS policies
-- Use SECURITY DEFINER helper functions to break the recursion

BEGIN;

-- Create helper function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
STABLE
AS $$
DECLARE
    user_is_admin boolean;
BEGIN
    SELECT (role = 'admin' AND approval_status = 'approved' AND is_active = true)
    INTO user_is_admin
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(user_is_admin, false);
END;
$$;

-- Create helper function to get current user's organization_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
STABLE
AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id
    INTO org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN org_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "profiles_select_org_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_org_admin" ON public.profiles;

-- Create new non-recursive policies using helper functions
CREATE POLICY "profiles_select_org_admin"
    ON public.profiles
    FOR SELECT
    TO public
    USING (
        is_current_user_admin() 
        AND organization_id = get_current_user_org_id()
    );

CREATE POLICY "profiles_update_org_admin"
    ON public.profiles
    FOR UPDATE
    TO public
    USING (
        is_current_user_admin() 
        AND organization_id = get_current_user_org_id()
    )
    WITH CHECK (
        is_current_user_admin() 
        AND organization_id = get_current_user_org_id()
    );

COMMIT;
