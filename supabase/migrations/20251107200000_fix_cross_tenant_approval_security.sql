-- Migration: Fix Cross-Tenant Approval Security Vulnerability (CVSS 9.0+)
-- Created: 2025-11-07
-- Purpose: Add organization validation to approve/reject_join_request RPCs
-- Security Issue: Admins from Org A could approve/reject join requests for Org B

BEGIN;

-- 1. Fix approve_join_request to validate admin's organization matches request's organization
CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_join_request_id UUID,
    p_admin_id UUID,
    p_assigned_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_organization_id UUID;
    v_admin_org_id UUID;
    v_user_email TEXT;
    v_user_name TEXT;
    v_requested_role TEXT;
    v_final_role TEXT;
    v_user_id UUID;
BEGIN
    -- Verify admin permissions
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.';
    END IF;

    -- Get join request details
    SELECT organization_id, email, name, role
    INTO v_organization_id, v_user_email, v_user_name, v_requested_role
    FROM public.join_requests
    WHERE id = p_join_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '대기 중인 가입 신청을 찾을 수 없습니다.';
    END IF;

    -- SECURITY FIX: Get admin's organization
    SELECT organization_id INTO v_admin_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- SECURITY FIX: Verify admin's org matches request's org
    IF v_admin_org_id IS DISTINCT FROM v_organization_id THEN
        RAISE EXCEPTION 'Cannot process join requests for other organizations';
    END IF;

    -- Determine final role (admin can override)
    v_final_role := COALESCE(p_assigned_role, v_requested_role);

    -- Validate role
    IF v_final_role NOT IN ('admin', 'doctor', 'nurse') THEN
        RAISE EXCEPTION '유효하지 않은 역할입니다: %', v_final_role;
    END IF;

    -- Find user by email (they should have already signed up)
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE email = v_user_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '해당 이메일로 가입한 사용자를 찾을 수 없습니다: %', v_user_email;
    END IF;

    -- Update user profile
    UPDATE public.profiles
    SET
        organization_id = v_organization_id,
        role = v_final_role::user_role,
        approval_status = 'approved'::approval_status,
        is_active = true,
        approved_by = p_admin_id,
        approved_at = NOW()
    WHERE id = v_user_id;

    -- Update join request
    UPDATE public.join_requests
    SET
        status = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_join_request_id;

    RAISE NOTICE '가입 신청 승인 완료: % (%)', v_user_name, v_user_email;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '가입 신청 승인 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_join_request IS '가입 신청 승인 (관리자만, 동일 조직 내)';

-- 2. Fix reject_join_request to validate admin's organization matches request's organization
CREATE OR REPLACE FUNCTION public.reject_join_request(
    p_join_request_id UUID,
    p_admin_id UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_organization_id UUID;
    v_admin_org_id UUID;
    v_user_email TEXT;
    v_user_name TEXT;
BEGIN
    -- Verify admin permissions
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.';
    END IF;

    -- Get join request details including organization_id
    SELECT organization_id, email, name
    INTO v_organization_id, v_user_email, v_user_name
    FROM public.join_requests
    WHERE id = p_join_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '대기 중인 가입 신청을 찾을 수 없습니다.';
    END IF;

    -- SECURITY FIX: Get admin's organization
    SELECT organization_id INTO v_admin_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- SECURITY FIX: Verify admin's org matches request's org
    IF v_admin_org_id IS DISTINCT FROM v_organization_id THEN
        RAISE EXCEPTION 'Cannot process join requests for other organizations';
    END IF;

    -- Update join request
    UPDATE public.join_requests
    SET
        status = 'rejected',
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_join_request_id;

    -- Optionally update user profile with rejection reason
    IF p_rejection_reason IS NOT NULL THEN
        UPDATE public.profiles
        SET
            approval_status = 'rejected'::approval_status,
            rejection_reason = p_rejection_reason
        WHERE email = v_user_email;
    END IF;

    RAISE NOTICE '가입 신청 거부 완료: % (%)', v_user_name, v_user_email;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '가입 신청 거부 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reject_join_request IS '가입 신청 거부 (관리자만, 동일 조직 내)';

COMMIT;

-- Security Audit Notes:
-- This migration fixes CVSS 9.0+ vulnerability where admins could approve/reject
-- join requests for organizations they don't belong to.
--
-- Changes:
-- 1. Added organization_id retrieval from join_requests
-- 2. Added admin's organization_id lookup from profiles using auth.uid()
-- 3. Added validation: admin's org must match request's org
-- 4. Error message: 'Cannot process join requests for other organizations'
--
-- Expected Test Behavior:
-- - Admin A (Org A) attempts to approve join request for Org B → BLOCKED
-- - Admin B (Org B) approves join request for Org B → ALLOWED
-- - Admin A (Org A) attempts to reject join request for Org B → BLOCKED
-- - Admin B (Org B) rejects join request for Org B → ALLOWED
