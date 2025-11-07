-- Migration: Fix RPC auth.uid() Validation Security Vulnerability (CVSS 9.0+)
-- Created: 2025-11-07
-- Purpose: Add auth.uid() validation to create_organization_and_register_user RPC
-- Security Issue: Attacker could modify other users' profiles by passing different p_user_id

BEGIN;

-- Fix create_organization_and_register_user to validate p_user_id matches auth.uid()
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
    -- SECURITY FIX: Validate that p_user_id matches authenticated user
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Can only modify your own profile';
    END IF;

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

COMMENT ON FUNCTION public.create_organization_and_register_user IS '새 조직 생성 및 사용자를 첫 관리자로 등록 (자신의 프로필만)';

COMMIT;

-- Security Audit Notes:
-- This migration fixes CVSS 9.0+ vulnerability where users could modify
-- other users' profiles by passing a different p_user_id parameter.
--
-- Changes:
-- 1. Added validation: auth.uid() must match p_user_id
-- 2. Error message: 'Can only modify your own profile'
--
-- Expected Test Behavior:
-- - User A calls RPC with p_user_id = User A's ID → ALLOWED
-- - User A calls RPC with p_user_id = User B's ID → BLOCKED
--
-- Alternative Solution (More Secure):
-- Remove p_user_id parameter entirely and use auth.uid() directly.
-- However, keeping parameter for backward compatibility with explicit validation.
