-- Migration: Create RLS helper function and update RLS policies for multi-tenancy
-- Created: 2025-11-07
-- Purpose: Implement organization-based data isolation through RLS policies

BEGIN;

-- 1. Create helper function to get current user's organization_id
CREATE OR REPLACE FUNCTION auth.get_current_user_organization_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION auth.get_current_user_organization_id() IS '현재 사용자의 organization_id를 반환합니다 (RLS 정책용)';

-- 2. Update profiles RLS policies
-- Keep existing policies but add organization-based ones for future use
-- Profiles are special: users should see only their own profile or profiles in their organization (for admins)

DROP POLICY IF EXISTS "profiles_org_select" ON public.profiles;
CREATE POLICY "profiles_org_select"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid() OR  -- Own profile
        (is_user_admin() AND organization_id = auth.get_current_user_organization_id())  -- Same org (admin only)
    );

-- 3. Update patients RLS policies
-- Replace existing policies with organization-filtered versions

DROP POLICY IF EXISTS "patients_secure_select" ON public.patients;
CREATE POLICY "patients_secure_select"
    ON public.patients FOR SELECT
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "patients_secure_insert" ON public.patients;
CREATE POLICY "patients_secure_insert"
    ON public.patients FOR INSERT
    WITH CHECK (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "patients_secure_update" ON public.patients;
CREATE POLICY "patients_secure_update"
    ON public.patients FOR UPDATE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "patients_secure_delete" ON public.patients;
CREATE POLICY "patients_secure_delete"
    ON public.patients FOR DELETE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

-- 4. Update schedules RLS policies

DROP POLICY IF EXISTS "schedules_secure_select" ON public.schedules;
CREATE POLICY "schedules_secure_select"
    ON public.schedules FOR SELECT
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "schedules_secure_insert" ON public.schedules;
CREATE POLICY "schedules_secure_insert"
    ON public.schedules FOR INSERT
    WITH CHECK (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "schedules_secure_update" ON public.schedules;
CREATE POLICY "schedules_secure_update"
    ON public.schedules FOR UPDATE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "schedules_secure_delete" ON public.schedules;
CREATE POLICY "schedules_secure_delete"
    ON public.schedules FOR DELETE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

-- 5. Update schedule_executions RLS policies

DROP POLICY IF EXISTS "executions_secure_select" ON public.schedule_executions;
CREATE POLICY "executions_secure_select"
    ON public.schedule_executions FOR SELECT
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "executions_secure_insert" ON public.schedule_executions;
CREATE POLICY "executions_secure_insert"
    ON public.schedule_executions FOR INSERT
    WITH CHECK (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "executions_secure_update" ON public.schedule_executions;
CREATE POLICY "executions_secure_update"
    ON public.schedule_executions FOR UPDATE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "executions_secure_delete" ON public.schedule_executions;
CREATE POLICY "executions_secure_delete"
    ON public.schedule_executions FOR DELETE
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

-- 6. Update items RLS policies
-- Items are managed per organization, admins can manage their org's items

DROP POLICY IF EXISTS "items_secure_select" ON public.items;
CREATE POLICY "items_secure_select"
    ON public.items FOR SELECT
    USING (
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "items_secure_insert" ON public.items;
CREATE POLICY "items_secure_insert"
    ON public.items FOR INSERT
    WITH CHECK (
        is_user_admin() AND
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "items_secure_update" ON public.items;
CREATE POLICY "items_secure_update"
    ON public.items FOR UPDATE
    USING (
        is_user_admin() AND
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

DROP POLICY IF EXISTS "items_secure_delete" ON public.items;
CREATE POLICY "items_secure_delete"
    ON public.items FOR DELETE
    USING (
        is_user_admin() AND
        is_user_active_and_approved() AND
        organization_id = auth.get_current_user_organization_id()
    );

-- 7. Update notifications RLS policies

DROP POLICY IF EXISTS "notifications_secure_select" ON public.notifications;
CREATE POLICY "notifications_secure_select"
    ON public.notifications FOR SELECT
    USING (
        (recipient_id = auth.uid() OR is_user_admin()) AND
        organization_id = auth.get_current_user_organization_id()
    );

-- 8. Update audit_logs RLS policies
-- Admins can view audit logs for their organization only

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        is_user_admin() AND
        organization_id = auth.get_current_user_organization_id()
    );

COMMIT;
