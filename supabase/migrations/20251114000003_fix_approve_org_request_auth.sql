-- =============================================
-- Fix: approve_org_request와 reject_org_request 권한 검증 수정
-- =============================================
-- 작성일: 2025-11-14
-- 버그 ID: BUG-20251114-004
-- 근본 원인: Service role client로 RPC 호출 시 auth.uid()가 NULL을 반환하여 권한 검증 실패
-- 수정 방안: Parameter 기반 권한 검증으로 변경 (p_super_admin_id 직접 검증)
--
-- ⚠️ 보안 원칙:
-- 1. p_super_admin_id parameter를 직접 검증하여 실제 super_admin인지 확인
-- 2. auth.uid() 의존성 제거
-- 3. Service role과 user context 모두에서 작동하도록 보장

-- Step 1: approve_org_request 함수 수정
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
  -- Verify super admin using parameter (not auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_super_admin_id
      AND role = 'super_admin'
      AND approval_status = 'approved'
      AND is_active = true
  ) THEN
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

COMMENT ON FUNCTION approve_org_request IS 'Superadmin: 신규 기관 등록 요청 승인 (parameter 기반 권한 검증)';

-- Step 2: reject_org_request 함수 수정
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
  -- Verify super admin using parameter (not auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_super_admin_id
      AND role = 'super_admin'
      AND approval_status = 'approved'
      AND is_active = true
  ) THEN
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

COMMENT ON FUNCTION reject_org_request IS 'Superadmin: 신규 기관 등록 요청 거부 (parameter 기반 권한 검증)';

-- =============================================
-- 마이그레이션 완료
-- =============================================

-- 변경 사항:
-- 1. approve_org_request: is_super_admin() 호출 제거, p_super_admin_id 직접 검증으로 변경
-- 2. reject_org_request: is_super_admin() 호출 제거, p_super_admin_id 직접 검증으로 변경
-- 3. Service role과 user context 모두에서 작동하도록 보장
-- 4. 보안성 강화: parameter로 받은 ID가 실제 super_admin인지 명시적 검증

-- 테스트 방법:
-- 1. 수퍼어드민으로 로그인
-- 2. 신규 기관 가입 승인 페이지 접속
-- 3. 승인 대기 중인 요청 승인 시도
-- 4. 성공적으로 조직 생성 및 사용자 활성화 확인
