-- Migration: Create RPC functions for organization management
-- Created: 2025-11-07
-- Purpose: Implement organization creation and user registration workflow

BEGIN;

-- 1. Function to create new organization and register user
CREATE OR REPLACE FUNCTION public.create_organization_and_register_user(
    p_organization_name TEXT,
    p_user_id UUID,
    p_user_name TEXT,
    p_user_role TEXT DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Validate organization name
    IF p_organization_name IS NULL OR TRIM(p_organization_name) = '' THEN
        RAISE EXCEPTION '조직명은 필수입니다.';
    END IF;

    -- Validate user role
    IF p_user_role NOT IN ('admin', 'doctor', 'nurse') THEN
        RAISE EXCEPTION '유효하지 않은 역할입니다: %', p_user_role;
    END IF;

    -- 1. 새 조직 생성
    INSERT INTO public.organizations (name)
    VALUES (p_organization_name)
    RETURNING id INTO new_org_id;

    -- 2. 사용자 프로필 업데이트 (organization 할당 및 승인)
    UPDATE public.profiles
    SET
        organization_id = new_org_id,
        role = p_user_role::user_role,
        approval_status = 'approved'::approval_status,
        is_active = true,
        approved_at = NOW(),
        approved_by = p_user_id  -- Self-approval for first admin
    WHERE id = p_user_id;

    -- Verify update
    IF NOT FOUND THEN
        RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', p_user_id;
    END IF;

    RAISE NOTICE '새 조직 생성 완료: % (ID: %), 첫 관리자: %', p_organization_name, new_org_id, p_user_name;

    RETURN new_org_id;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '이미 존재하는 조직명입니다: %', p_organization_name;
    WHEN OTHERS THEN
        RAISE EXCEPTION '조직 생성 또는 사용자 등록 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_organization_and_register_user IS '새 조직 생성 및 사용자를 첫 관리자로 등록 (트랜잭션)';

-- 2. Function to search organizations by name
CREATE OR REPLACE FUNCTION public.search_organizations(
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.created_at,
        COUNT(p.id) as member_count
    FROM public.organizations o
    LEFT JOIN public.profiles p ON p.organization_id = o.id
    WHERE o.name ILIKE '%' || p_search_term || '%'
    GROUP BY o.id, o.name, o.created_at
    ORDER BY o.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.search_organizations IS '조직명으로 조직 검색 (가입 신청 UI용)';

-- 3. Function to approve join request
CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_join_request_id UUID,
    p_admin_id UUID,
    p_assigned_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_organization_id UUID;
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

COMMENT ON FUNCTION public.approve_join_request IS '가입 신청 승인 (관리자만)';

-- 4. Function to reject join request
CREATE OR REPLACE FUNCTION public.reject_join_request(
    p_join_request_id UUID,
    p_admin_id UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email TEXT;
    v_user_name TEXT;
BEGIN
    -- Verify admin permissions
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.';
    END IF;

    -- Get join request details
    SELECT email, name
    INTO v_user_email, v_user_name
    FROM public.join_requests
    WHERE id = p_join_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '대기 중인 가입 신청을 찾을 수 없습니다.';
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

COMMENT ON FUNCTION public.reject_join_request IS '가입 신청 거부 (관리자만)';

COMMIT;
