-- Migration: Add multitenancy tables (organizations, join_requests, invitations)
-- Created: 2025-11-07
-- Purpose: Implement multi-tenant architecture with organization-based data isolation

BEGIN;

-- 1. Organization 테이블
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 조직명은 중복 불가 (검색 기능 위해)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS '각 사용자 그룹(기관) 정보를 저장합니다.';
COMMENT ON COLUMN public.organizations.name IS '조직명 (검색 및 중복 방지용)';

-- 2. Join Requests 테이블 (신규 가입 신청 관리)
CREATE TABLE IF NOT EXISTS public.join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL, -- 신청자 이름
    role TEXT NOT NULL DEFAULT 'nurse', -- 신청 시 희망 역할: 'admin', 'doctor', 'nurse'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by UUID REFERENCES auth.users(id), -- 승인/거부한 관리자 ID
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_requests_organization ON public.join_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_email ON public.join_requests (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_unique_pending
    ON public.join_requests (organization_id, email, status)
    WHERE (status = 'pending'); -- 동일 조직 대기중 중복 신청 방지

COMMENT ON TABLE public.join_requests IS '신규 사용자의 조직 가입 신청을 관리합니다.';
COMMENT ON COLUMN public.join_requests.status IS '가입 신청 상태: pending, approved, rejected';

-- 3. Invitations 테이블 (기존 사용자 초대용, 선택적)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'nurse', -- 'admin', 'doctor', 'nurse'
    token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_invitations_organization ON public.invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_unique_pending
    ON public.invitations (organization_id, email, status)
    WHERE (status = 'pending'); -- 조직 내 대기중인 이메일 중복 초대 방지

COMMENT ON TABLE public.invitations IS '사용자를 조직에 초대하기 위한 테이블입니다.';
COMMENT ON COLUMN public.invitations.token IS '초대 링크에 사용되는 고유 토큰';

-- 4. Add updated_at trigger to organizations
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for organizations
CREATE POLICY "Anyone can view organizations for search"
    ON public.organizations FOR SELECT
    USING (true); -- 가입 시 조직 검색을 위해 누구나 조회 가능

CREATE POLICY "Only admins can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (is_user_admin());

CREATE POLICY "Only admins can update organizations"
    ON public.organizations FOR UPDATE
    USING (is_user_admin());

CREATE POLICY "Only admins can delete organizations"
    ON public.organizations FOR DELETE
    USING (is_user_admin());

-- 7. RLS Policies for join_requests
CREATE POLICY "Users can view their own join requests"
    ON public.join_requests FOR SELECT
    USING (email = auth.jwt()->>'email' OR is_user_admin());

CREATE POLICY "Anyone can create join requests"
    ON public.join_requests FOR INSERT
    WITH CHECK (true); -- 가입 신청은 누구나 가능

CREATE POLICY "Only admins can update join requests"
    ON public.join_requests FOR UPDATE
    USING (is_user_admin());

-- 8. RLS Policies for invitations
CREATE POLICY "Users can view their own invitations"
    ON public.invitations FOR SELECT
    USING (email = auth.jwt()->>'email' OR is_user_admin());

CREATE POLICY "Only admins can manage invitations"
    ON public.invitations FOR INSERT
    WITH CHECK (is_user_admin());

CREATE POLICY "Only admins can update invitations"
    ON public.invitations FOR UPDATE
    USING (is_user_admin());

COMMIT;
