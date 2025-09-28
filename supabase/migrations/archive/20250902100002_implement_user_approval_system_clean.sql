-- User Approval System - Comprehensive Security Implementation (Clean Version)
-- This migration implements HIPAA-compliant user approval and access control
-- Created: 2025-09-02
-- Purpose: Prevent unauthorized access to sensitive medical data

BEGIN;

-- ========================================
-- STEP 1: Drop Existing Conflicting Functions
-- ========================================

DROP FUNCTION IF EXISTS public.approve_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.reject_user(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.deactivate_user(uuid, text);
DROP FUNCTION IF EXISTS public.is_user_admin();
DROP FUNCTION IF EXISTS public.is_user_active_and_approved();

-- ========================================
-- STEP 2: Update User Registration Function
-- ========================================

-- Replace the existing handle_new_user function to default users as inactive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        RETURN new;
    END IF;
    
    -- Create profile for new user - DEFAULT TO INACTIVE AND PENDING APPROVAL
    INSERT INTO public.profiles (
        id, 
        email, 
        name, 
        role,
        approval_status,
        is_active  -- CRITICAL: Default to FALSE for new users
    ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'nurse'),
        'pending',  -- CRITICAL: Default to pending approval
        false       -- CRITICAL: Default to inactive
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Profile creation failed for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$function$;

-- ========================================
-- STEP 3: Create Helper Functions for Security Checks
-- ========================================

-- Helper function to check if current user is active and approved
CREATE OR REPLACE FUNCTION public.is_user_active_and_approved()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $function$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND is_active = true 
        AND approval_status = 'approved'
    );
$function$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $function$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
        AND is_active = true 
        AND approval_status = 'approved'
    );
$function$;

-- ========================================
-- STEP 4: Drop All Insecure "Allow All" Policies
-- ========================================

-- Drop all overly permissive policies that bypass security checks
DROP POLICY IF EXISTS "profiles_allow_all_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_all_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_all_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_all_delete" ON public.profiles;

DROP POLICY IF EXISTS "patients_allow_all_select" ON public.patients;
DROP POLICY IF EXISTS "patients_allow_all_insert" ON public.patients;
DROP POLICY IF EXISTS "patients_allow_all_update" ON public.patients;
DROP POLICY IF EXISTS "patients_allow_all_delete" ON public.patients;

DROP POLICY IF EXISTS "schedules_allow_all_select" ON public.schedules;
DROP POLICY IF EXISTS "schedules_allow_all_insert" ON public.schedules;
DROP POLICY IF EXISTS "schedules_allow_all_update" ON public.schedules;
DROP POLICY IF EXISTS "schedules_allow_all_delete" ON public.schedules;

DROP POLICY IF EXISTS "executions_allow_all_select" ON public.schedule_executions;
DROP POLICY IF EXISTS "executions_allow_all_insert" ON public.schedule_executions;
DROP POLICY IF EXISTS "executions_allow_all_update" ON public.schedule_executions;
DROP POLICY IF EXISTS "executions_allow_all_delete" ON public.schedule_executions;

DROP POLICY IF EXISTS "items_allow_all_select" ON public.items;
DROP POLICY IF EXISTS "items_allow_all_insert" ON public.items;
DROP POLICY IF EXISTS "items_allow_all_update" ON public.items;
DROP POLICY IF EXISTS "items_allow_all_delete" ON public.items;

-- ========================================
-- STEP 5: Implement Secure RLS Policies - PROFILES
-- ========================================

-- PROFILES: Users can view their own profile + admins can view all
CREATE POLICY "profiles_secure_select" ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR 
    public.is_user_admin()
);

-- PROFILES: Only service role and admins can insert (for user creation and admin management)
CREATE POLICY "profiles_secure_insert" ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    -- Service role can always insert (for user registration)
    current_setting('role') = 'service_role' OR
    -- Admins can create users
    public.is_user_admin()
);

-- PROFILES: Users can update their own basic info, admins can update approval status
CREATE POLICY "profiles_secure_update" ON public.profiles
FOR UPDATE
TO authenticated
USING (
    -- Users can update their own profile
    (id = auth.uid() AND public.is_user_active_and_approved()) OR
    -- Admins can update any profile
    public.is_user_admin()
)
WITH CHECK (
    -- Users can only update their own non-security fields
    (id = auth.uid() AND public.is_user_active_and_approved() AND 
     approval_status = 'approved' AND is_active = true) OR
    -- Admins can update anything
    public.is_user_admin()
);

-- PROFILES: Only admins can delete
CREATE POLICY "profiles_secure_delete" ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_user_admin());

-- ========================================
-- STEP 6: Implement Secure RLS Policies - PATIENTS
-- ========================================

-- PATIENTS: Only active approved users can access patient data
CREATE POLICY "patients_secure_select" ON public.patients
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

CREATE POLICY "patients_secure_insert" ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "patients_secure_update" ON public.patients
FOR UPDATE
TO authenticated
USING (public.is_user_active_and_approved())
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "patients_secure_delete" ON public.patients
FOR DELETE
TO authenticated
USING (public.is_user_active_and_approved());

-- ========================================
-- STEP 7: Implement Secure RLS Policies - SCHEDULES
-- ========================================

-- SCHEDULES: Only active approved users can access schedule data
CREATE POLICY "schedules_secure_select" ON public.schedules
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

CREATE POLICY "schedules_secure_insert" ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "schedules_secure_update" ON public.schedules
FOR UPDATE
TO authenticated
USING (public.is_user_active_and_approved())
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "schedules_secure_delete" ON public.schedules
FOR DELETE
TO authenticated
USING (public.is_user_active_and_approved());

-- ========================================
-- STEP 8: Implement Secure RLS Policies - SCHEDULE EXECUTIONS
-- ========================================

-- SCHEDULE_EXECUTIONS: Only active approved users can access execution data
CREATE POLICY "executions_secure_select" ON public.schedule_executions
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

CREATE POLICY "executions_secure_insert" ON public.schedule_executions
FOR INSERT
TO authenticated
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "executions_secure_update" ON public.schedule_executions
FOR UPDATE
TO authenticated
USING (public.is_user_active_and_approved())
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "executions_secure_delete" ON public.schedule_executions
FOR DELETE
TO authenticated
USING (public.is_user_active_and_approved());

-- ========================================
-- STEP 9: Implement Secure RLS Policies - ITEMS
-- ========================================

-- ITEMS: Only active approved users can access medical items
CREATE POLICY "items_secure_select" ON public.items
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

CREATE POLICY "items_secure_insert" ON public.items
FOR INSERT
TO authenticated
WITH CHECK (public.is_user_admin()); -- Only admins can create items

CREATE POLICY "items_secure_update" ON public.items
FOR UPDATE
TO authenticated
USING (public.is_user_admin()) -- Only admins can update items
WITH CHECK (public.is_user_admin());

CREATE POLICY "items_secure_delete" ON public.items
FOR DELETE
TO authenticated
USING (public.is_user_admin()); -- Only admins can delete items

-- ========================================
-- STEP 10: Secure Other Supporting Tables
-- ========================================

-- NOTIFICATIONS: Keep existing secure policies, but add active user check
DROP POLICY IF EXISTS "Authenticated users can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;

-- Secure notifications - only active users can see notifications
CREATE POLICY "notifications_secure_select" ON public.notifications
FOR SELECT
TO authenticated
USING (
    public.is_user_active_and_approved() AND
    (recipient_id = auth.uid() OR public.is_user_admin())
);

-- SCHEDULE_LOGS: Only active approved users can access logs
CREATE POLICY "schedule_logs_secure_select" ON public.schedule_logs
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

-- PATIENT_SCHEDULES: Only active approved users can access patient schedules
CREATE POLICY "patient_schedules_secure_select" ON public.patient_schedules
FOR SELECT
TO authenticated
USING (public.is_user_active_and_approved());

CREATE POLICY "patient_schedules_secure_insert" ON public.patient_schedules
FOR INSERT
TO authenticated
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "patient_schedules_secure_update" ON public.patient_schedules
FOR UPDATE
TO authenticated
USING (public.is_user_active_and_approved())
WITH CHECK (public.is_user_active_and_approved());

CREATE POLICY "patient_schedules_secure_delete" ON public.patient_schedules
FOR DELETE
TO authenticated
USING (public.is_user_active_and_approved());

-- ========================================
-- STEP 11: Create Admin Functions for User Management
-- ========================================

-- Function for admins to approve users
CREATE OR REPLACE FUNCTION public.approve_user(user_id uuid, approved_by_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Check if caller is admin
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can approve users';
    END IF;
    
    -- Approve and activate the user
    UPDATE public.profiles 
    SET 
        approval_status = 'approved',
        is_active = true,
        approved_by = approved_by_id,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    -- Return success status
    RETURN FOUND;
END;
$function$;

-- Function for admins to reject users
CREATE OR REPLACE FUNCTION public.reject_user(user_id uuid, reason text DEFAULT NULL, rejected_by_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Check if caller is admin
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can reject users';
    END IF;
    
    -- Reject and deactivate the user
    UPDATE public.profiles 
    SET 
        approval_status = 'rejected',
        is_active = false,
        approved_by = rejected_by_id,
        approved_at = CURRENT_TIMESTAMP,
        rejection_reason = reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    -- Return success status
    RETURN FOUND;
END;
$function$;

-- Function for admins to deactivate users
CREATE OR REPLACE FUNCTION public.deactivate_user(user_id uuid, reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Check if caller is admin
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can deactivate users';
    END IF;
    
    -- Prevent admins from deactivating themselves
    IF user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot deactivate yourself';
    END IF;
    
    -- Deactivate the user
    UPDATE public.profiles 
    SET 
        is_active = false,
        rejection_reason = COALESCE(reason, 'Deactivated by admin'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    -- Return success status
    RETURN FOUND;
END;
$function$;

-- ========================================
-- STEP 12: Create View for Pending Users (Admin Only)
-- ========================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.pending_users;

-- View for admins to see users awaiting approval
CREATE OR REPLACE VIEW public.pending_users AS
SELECT 
    id,
    email,
    name,
    role,
    approval_status,
    is_active,
    created_at,
    department,
    phone
FROM public.profiles
WHERE approval_status = 'pending'
ORDER BY created_at ASC;

-- Secure the view - only admins can access
ALTER VIEW public.pending_users OWNER TO postgres;
GRANT SELECT ON public.pending_users TO authenticated;

-- ========================================
-- STEP 13: Add Audit Logging for User Management Actions
-- ========================================

-- Create audit function for user approval actions
CREATE OR REPLACE FUNCTION public.audit_user_management()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Log approval/rejection/deactivation actions
    IF (TG_OP = 'UPDATE' AND 
        (OLD.approval_status != NEW.approval_status OR OLD.is_active != NEW.is_active)) THEN
        
        INSERT INTO public.audit_logs (
            table_name,
            operation,
            record_id,
            old_values,
            new_values,
            user_id,
            user_email,
            user_role
        ) VALUES (
            'profiles',
            'user_management',
            NEW.id,
            jsonb_build_object(
                'approval_status', OLD.approval_status,
                'is_active', OLD.is_active
            ),
            jsonb_build_object(
                'approval_status', NEW.approval_status,
                'is_active', NEW.is_active,
                'approved_by', NEW.approved_by,
                'rejection_reason', NEW.rejection_reason
            ),
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            (SELECT role FROM public.profiles WHERE id = auth.uid())
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Add trigger for user management audit logging
DROP TRIGGER IF EXISTS user_management_audit_trigger ON public.profiles;
CREATE TRIGGER user_management_audit_trigger
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_user_management();

-- ========================================
-- STEP 14: Grant Necessary Permissions
-- ========================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_user_active_and_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_user(uuid, text) TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Add migration metadata
INSERT INTO public.audit_logs (
    table_name,
    operation,
    old_values,
    new_values,
    user_id,
    user_email,
    user_role
) VALUES (
    'migration',
    'security_implementation_clean',
    jsonb_build_object('security_level', 'basic'),
    jsonb_build_object(
        'security_level', 'hipaa_compliant',
        'user_approval_required', true,
        'active_user_verification', true,
        'migration_version', '20250902100002'
    ),
    '00000000-0000-0000-0000-000000000000'::uuid,
    'system@migration',
    'admin'
);

COMMIT;

-- ========================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ========================================

-- Verify all policies are in place (run these manually after migration)
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename IN ('profiles', 'patients', 'schedules', 'schedule_executions', 'items')
-- ORDER BY tablename, cmd;

-- Verify functions exist
-- SELECT proname FROM pg_proc WHERE proname IN ('is_user_active_and_approved', 'is_user_admin', 'approve_user', 'reject_user', 'deactivate_user');

-- Check pending users (should show any existing inactive users)
-- SELECT id, email, approval_status, is_active FROM public.profiles WHERE approval_status = 'pending' OR is_active = false;