-- =============================================
-- Super Admin 역할 추가 및 RLS 정책 설정
-- =============================================
-- 작성일: 2025-11-08
-- 목적: Super Admin 역할 추가 (조직/사용자 관리, 환자 데이터 접근 금지)

-- Step 1: user_role enum에 'super_admin' 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
    RAISE NOTICE 'Added super_admin to user_role enum';
  ELSE
    RAISE NOTICE 'super_admin already exists in user_role enum';
  END IF;
END $$;

-- Step 2: profiles.organization_id NULL 허용 (super_admin만 NULL 가능)
DO $$
BEGIN
  -- organization_id 컬럼의 NOT NULL 제약 조건 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'organization_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN organization_id DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from profiles.organization_id';
  ELSE
    RAISE NOTICE 'profiles.organization_id already allows NULL';
  END IF;
END $$;

-- Step 3: organizations 테이블에 is_active 컬럼 추가 (soft delete용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    RAISE NOTICE 'Added is_active column to organizations table';
  ELSE
    RAISE NOTICE 'is_active column already exists in organizations table';
  END IF;
END $$;

-- is_active 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);

-- Step 4: RLS 헬퍼 함수 (search_path 설정 포함 - 보안 강화)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND approval_status = 'approved'
      AND is_active = true
  );
END;
$$;

COMMENT ON FUNCTION is_super_admin() IS 'Super Admin 역할 확인 (환자 데이터 접근 불가)';

-- Step 5: organizations RLS - Super Admin 전체 접근
DROP POLICY IF EXISTS "super_admin_organizations_all" ON organizations;
CREATE POLICY "super_admin_organizations_all"
ON organizations FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Step 6: profiles RLS - Super Admin 전체 조회
DROP POLICY IF EXISTS "super_admin_profiles_select" ON profiles;
CREATE POLICY "super_admin_profiles_select"
ON profiles FOR SELECT
USING (is_super_admin());

-- Step 7: profiles RLS - Super Admin 전체 수정
DROP POLICY IF EXISTS "super_admin_profiles_update" ON profiles;
CREATE POLICY "super_admin_profiles_update"
ON profiles FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Step 8: join_requests RLS - Super Admin 전체 조회
DROP POLICY IF EXISTS "super_admin_join_requests_select" ON join_requests;
CREATE POLICY "super_admin_join_requests_select"
ON join_requests FOR SELECT
USING (is_super_admin());

-- Step 9: audit_logs - Super Admin은 메타데이터(조직/사용자 관리)만 조회
-- audit_logs 테이블 구조: table_name, operation (INSERT/UPDATE/DELETE)
-- Super Admin은 organizations와 profiles 테이블 로그만 조회 가능
DROP POLICY IF EXISTS "super_admin_audit_meta_only" ON audit_logs;
CREATE POLICY "super_admin_audit_meta_only"
ON audit_logs FOR SELECT
USING (
  is_super_admin() AND
  table_name IN ('organizations', 'profiles')
);

-- =============================================
-- 마이그레이션 완료
-- =============================================

-- 다음 단계 (수동 실행):
-- 1. 이 마이그레이션을 Supabase Dashboard SQL Editor에서 실행
-- 2. TypeScript 타입 재생성: npx supabase gen types typescript --project-id xlhtmakvxbdjnpvtzdqh > src/lib/database.types.ts
-- 3. 첫 Super Admin 계정 생성 (Supabase Dashboard에서 수동 실행):
--    UPDATE profiles SET role = 'super_admin', organization_id = NULL WHERE email = 'your-email@example.com';
