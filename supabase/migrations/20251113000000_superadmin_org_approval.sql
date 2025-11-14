-- =============================================
-- Superadmin 신규 기관 등록 승인 시스템
-- =============================================
-- 작성일: 2025-11-13
-- 목적: 신규 기관 등록 요청 및 Superadmin 승인 시스템 구축
--
-- ⚠️ 보안 원칙:
-- 1. 비밀번호는 auth.users에서만 관리 (organization_requests에 저장 금지)
-- 2. 기관 승인 시 원자적 트랜잭션 처리
-- 3. 역할 기반 접근 제어 (super_admin 역할 사용)

-- Step 1: organization_requests 테이블 생성
CREATE TABLE IF NOT EXISTS organization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization Info
  organization_name text NOT NULL,
  organization_description text,

  -- Requester Info (Admin-to-be)
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  requester_name text NOT NULL,

  -- Status Management
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Review Info
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,

  -- Created Organization (after approval)
  created_organization_id uuid REFERENCES organizations(id),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Step 2: 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_org_requests_status ON organization_requests(status);
CREATE INDEX IF NOT EXISTS idx_org_requests_created_at ON organization_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_requests_user_id ON organization_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_org_requests_email ON organization_requests(requester_email);

-- Step 3: RLS 정책 설정
ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Requester can view own request by user_id
DROP POLICY IF EXISTS "org_requests_select_own" ON organization_requests;
CREATE POLICY "org_requests_select_own"
ON organization_requests FOR SELECT
USING (requester_user_id = auth.uid());

-- Policy: Super Admin can view all
DROP POLICY IF EXISTS "org_requests_select_super_admin" ON organization_requests;
CREATE POLICY "org_requests_select_super_admin"
ON organization_requests FOR SELECT
USING (is_super_admin());

-- Policy: Super Admin can update (approve/reject)
DROP POLICY IF EXISTS "org_requests_update_super_admin" ON organization_requests;
CREATE POLICY "org_requests_update_super_admin"
ON organization_requests FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Step 4: Updated timestamp trigger
CREATE TRIGGER update_org_requests_updated_at
  BEFORE UPDATE ON organization_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: approve_org_request RPC 함수
CREATE OR REPLACE FUNCTION approve_org_request(
  p_request_id uuid,
  p_super_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request organization_requests%ROWTYPE;
  v_new_org_id uuid;
  v_result jsonb;
BEGIN
  -- Verify super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin only';
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM organization_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Check duplicate organization name
  IF EXISTS (
    SELECT 1 FROM organizations
    WHERE LOWER(name) = LOWER(v_request.organization_name)
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Organization name already exists';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, is_active)
  VALUES (v_request.organization_name, true)
  RETURNING id INTO v_new_org_id;

  -- Update profile (assign organization and role)
  UPDATE profiles
  SET
    organization_id = v_new_org_id,
    role = 'admin',
    approval_status = 'approved',
    approved_by = p_super_admin_id,
    approved_at = now(),
    is_active = true
  WHERE id = v_request.requester_user_id;

  -- Update request
  UPDATE organization_requests
  SET
    status = 'approved',
    reviewed_by = p_super_admin_id,
    reviewed_at = now(),
    created_organization_id = v_new_org_id,
    updated_at = now()
  WHERE id = p_request_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'organization_id', v_new_org_id,
    'request_id', p_request_id
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to approve request: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION approve_org_request IS 'Superadmin: 신규 기관 등록 요청 승인 (원자적 트랜잭션)';

-- Step 6: reject_org_request RPC 함수
CREATE OR REPLACE FUNCTION reject_org_request(
  p_request_id uuid,
  p_super_admin_id uuid,
  p_rejection_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request organization_requests%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Verify super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin only';
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM organization_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Update request
  UPDATE organization_requests
  SET
    status = 'rejected',
    reviewed_by = p_super_admin_id,
    reviewed_at = now(),
    rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_request_id;

  -- Update profile rejection status
  UPDATE profiles
  SET
    approval_status = 'rejected',
    rejection_reason = p_rejection_reason,
    approved_by = p_super_admin_id,
    approved_at = now()
  WHERE id = v_request.requester_user_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected'
  );

  RETURN v_result;

END;
$$;

COMMENT ON FUNCTION reject_org_request IS 'Superadmin: 신규 기관 등록 요청 거부';

-- =============================================
-- 마이그레이션 완료
-- =============================================

-- 다음 단계:
-- 1. 이 마이그레이션 적용: npx supabase db push
-- 2. TypeScript 타입 재생성: npx supabase gen types typescript --project-id xlhtmakvxbdjnpvtzdqh > src/lib/database.types.ts
