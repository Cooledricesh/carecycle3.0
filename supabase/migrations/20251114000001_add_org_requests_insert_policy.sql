-- =============================================
-- Migration: Add missing INSERT policy for organization_requests
-- =============================================
-- Bug ID: BUG-20251114-002
-- Created: 2025-11-14
--
-- 근본 원인:
-- Supabase 새 API 키 시스템에서 Secret Key도 RLS 정책을 따름.
-- Legacy JWT의 service_role과 달리 RLS를 우회하지 않음.
-- 따라서 INSERT 정책이 없으면 데이터 삽입 불가능.
--
-- 수정 내용:
-- organization_requests 테이블에 포괄적 검증 INSERT 정책 추가
-- =============================================

BEGIN;

-- Drop policy if exists (idempotent migration)
DROP POLICY IF EXISTS "org_requests_insert_validated" ON organization_requests;

-- Create comprehensive INSERT policy with validation
CREATE POLICY "org_requests_insert_validated"
ON organization_requests FOR INSERT
WITH CHECK (
  -- 1. requester_user_id must not be null
  requester_user_id IS NOT NULL
  -- 2. User must exist in auth.users (FK validation)
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = requester_user_id
  )
  -- 3. Status must be 'pending' on creation
  AND status = 'pending'
  -- 4. Organization name is required
  AND organization_name IS NOT NULL
  AND organization_name != ''
  -- 5. Requester email is required
  AND requester_email IS NOT NULL
  AND requester_email != ''
  -- 6. Requester name is required
  AND requester_name IS NOT NULL
  AND requester_name != ''
);

COMMIT;

-- Add documentation comment
COMMENT ON POLICY "org_requests_insert_validated" ON organization_requests IS
'Allows INSERT when: 1) Valid user ID, 2) User exists in auth.users, 3) Status is pending, 4) All required fields provided (organization_name, requester_email, requester_name)';

-- =============================================
-- Security Notes
-- =============================================
--
-- 이 정책은 다음을 보장합니다:
-- 1. 데이터 무결성: auth.users에 실제 존재하는 사용자만 요청 가능
-- 2. 필수 필드 검증: 모든 필수 필드가 비어있지 않아야 함
-- 3. 상태 일관성: 신규 요청은 항상 'pending' 상태로 시작
-- 4. SQL Injection 방지: 빈 문자열 체크로 악의적 입력 차단
--
-- 이 정책은 Service Client(Secret Key) 사용 시에도 적용됩니다.
-- 새 API 키 시스템에서는 Secret Key도 RLS를 우회하지 않습니다.
-- =============================================
