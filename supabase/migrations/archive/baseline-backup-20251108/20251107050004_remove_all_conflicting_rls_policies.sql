-- Remove ALL RLS policies on profiles table to start clean
-- This will fix the infinite recursion issue

BEGIN;

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
DROP POLICY IF EXISTS "all_users_can_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_secure_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_secure_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_delete" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- Create simple, non-recursive policies
-- 1. Service role has full access
CREATE POLICY "profiles_service_role_all"
    ON public.profiles
    FOR ALL
    TO public
    USING (current_setting('role') = 'service_role');

-- 2. Users can SELECT their own profile (no recursion)
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    TO public
    USING (id = auth.uid());

-- 3. Users can INSERT their own profile (no recursion)
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    TO public
    WITH CHECK (id = auth.uid());

-- 4. Users can UPDATE their own profile (no recursion)
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    TO public
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 5. Admins can SELECT all profiles in their organization
-- Use a subquery that explicitly limits to prevent recursion
CREATE POLICY "profiles_select_org_admin"
    ON public.profiles
    FOR SELECT
    TO public
    USING (
        -- Admin check without recursive profile lookup
        EXISTS (
            SELECT 1 
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
            AND p.role = 'admin'
            AND p.approval_status = 'approved'
            AND p.is_active = true
            AND p.organization_id = profiles.organization_id
            LIMIT 1
        )
    );

-- 6. Admins can UPDATE profiles in their organization
CREATE POLICY "profiles_update_org_admin"
    ON public.profiles
    FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
            AND p.role = 'admin'
            AND p.approval_status = 'approved'
            AND p.is_active = true
            AND p.organization_id = profiles.organization_id
            LIMIT 1
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
            AND p.role = 'admin'
            AND p.approval_status = 'approved'
            AND p.is_active = true
            AND p.organization_id = profiles.organization_id
            LIMIT 1
        )
    );

-- 7. No DELETE policy (disable deletes except service role)

COMMIT;
