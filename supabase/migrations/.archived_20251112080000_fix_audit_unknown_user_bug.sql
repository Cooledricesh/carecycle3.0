-- Migration: Fix "알 수 없음" in Activity Logs (BUG-2025-11-12-ACTIVITY-LOG-UNKNOWN-USER)
--
-- Root Cause: profiles.name이 NULL일 때 audit_logs.user_name도 NULL로 저장됨
--
-- Solution:
-- 1. get_user_profile_for_audit() 함수 개선: email 기반 fallback 추가
-- 2. 기존 NULL user_name 데이터 보정
-- 3. handle_new_user() 트리거 개선: name DEFAULT 값 강화
--
-- Author: Claude Code (fix-validator)
-- Date: 2025-11-12
-- Bug ID: BUG-2025-11-12-ACTIVITY-LOG-UNKNOWN-USER

BEGIN;

-- ============================================================================
-- STEP 1: get_user_profile_for_audit() 함수 개선
-- ============================================================================
--
-- 변경 사항:
-- - profiles.name이 NULL일 때 email 앞부분을 name으로 사용
-- - COALESCE를 사용한 fallback 체계 강화
--
CREATE OR REPLACE FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid")
RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
    -- This function runs with elevated privileges and bypasses RLS
    -- It's safe because it's only used internally by the audit trigger
    --
    -- Fallback strategy:
    -- 1. Use profiles.name if available
    -- 2. Fallback to email username (part before @)
    -- 3. Fallback to 'unknown' (should never happen)
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        COALESCE(
            p.name,
            split_part(p.email, '@', 1),
            'unknown'
        )::TEXT as name,
        p.role::TEXT
    FROM public.profiles p
    WHERE p.id = target_user_id;
END;
$$;

COMMENT ON FUNCTION "public"."get_user_profile_for_audit"("target_user_id" "uuid") IS
'Returns user profile information for audit logging with email-based fallback for NULL names. Used by audit_table_changes() trigger.';

-- ============================================================================
-- STEP 2: 기존 profiles 테이블의 NULL name 데이터 보정
-- ============================================================================
--
-- profiles.name이 NULL인 레코드를 찾아서 email 앞부분으로 업데이트
--
UPDATE public.profiles
SET
    name = split_part(email, '@', 1),
    updated_at = NOW()
WHERE
    name IS NULL
    AND email IS NOT NULL;

-- 보정 결과 로그
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM public.profiles
    WHERE name IS NULL;

    IF updated_count > 0 THEN
        RAISE NOTICE 'WARNING: % profiles still have NULL name after migration', updated_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All profiles now have non-NULL names';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: 기존 audit_logs의 NULL user_name 데이터 보정
-- ============================================================================
--
-- audit_logs.user_name이 NULL인 레코드를 user_email 기반으로 업데이트
--
UPDATE public.audit_logs
SET
    user_name = COALESCE(
        split_part(user_email, '@', 1),
        'unknown'
    )
WHERE
    user_name IS NULL
    AND user_email IS NOT NULL;

-- audit_logs에서 user_email도 NULL인 경우 (시스템 작업)
UPDATE public.audit_logs
SET
    user_name = 'system'
WHERE
    user_name IS NULL
    AND user_email IS NULL;

-- 보정 결과 로그
DO $$
DECLARE
    null_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM public.audit_logs
    WHERE user_name IS NULL;

    SELECT COUNT(*) INTO total_count
    FROM public.audit_logs;

    IF null_count > 0 THEN
        RAISE NOTICE 'WARNING: % audit_logs still have NULL user_name (total: %)', null_count, total_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All audit_logs now have non-NULL user_names (total: %)', total_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: handle_new_user() 트리거 개선 (중복 방지 및 fallback 강화)
-- ============================================================================
--
-- 변경 사항:
-- - name DEFAULT를 더 명확하게 처리
-- - email 기반 fallback 강화
-- - raw_user_meta_data 우선 사용
--
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
    -- 이미 프로필이 존재하면 스킵 (중복 생성 방지)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        RETURN new;
    END IF;

    -- 프로필 생성 with improved name fallback
    INSERT INTO public.profiles (
        id, email, name, role, approval_status, is_active
    ) VALUES (
        new.id,
        new.email,
        -- Enhanced fallback strategy:
        -- 1. raw_user_meta_data.name (from signup API)
        -- 2. email username (before @)
        -- 3. 'User' (should never happen)
        COALESCE(
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1),
            'User'
        ),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'nurse'),
        'pending',
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, profiles.name, split_part(EXCLUDED.email, '@', 1)),
        role = EXCLUDED.role,
        updated_at = NOW();

    RETURN new;
END;
$$;

COMMENT ON FUNCTION "public"."handle_new_user"() IS
'Trigger function to create profile when new user signs up. Includes enhanced name fallback to prevent NULL names.';

-- ============================================================================
-- STEP 5: 검증 쿼리 (migration 적용 후 확인용)
-- ============================================================================

-- 검증 1: profiles에 NULL name이 있는지 확인
DO $$
DECLARE
    null_profiles_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_profiles_count
    FROM public.profiles
    WHERE name IS NULL;

    IF null_profiles_count > 0 THEN
        RAISE WARNING 'VERIFICATION FAILED: % profiles have NULL name', null_profiles_count;
    ELSE
        RAISE NOTICE 'VERIFICATION PASSED: No profiles with NULL name';
    END IF;
END $$;

-- 검증 2: audit_logs에 NULL user_name이 있는지 확인
DO $$
DECLARE
    null_audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_audit_count
    FROM public.audit_logs
    WHERE user_name IS NULL;

    IF null_audit_count > 0 THEN
        RAISE WARNING 'VERIFICATION FAILED: % audit_logs have NULL user_name', null_audit_count;
    ELSE
        RAISE NOTICE 'VERIFICATION PASSED: No audit_logs with NULL user_name';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
--
-- Changes Made:
-- 1. ✅ get_user_profile_for_audit() - Added email-based fallback
-- 2. ✅ profiles.name NULL records - Backfilled with email usernames
-- 3. ✅ audit_logs.user_name NULL records - Backfilled with email usernames
-- 4. ✅ handle_new_user() trigger - Enhanced name fallback logic
--
-- Expected Results:
-- - No more "알 수 없음" in activity logs
-- - All profiles have valid names
-- - All audit_logs have valid user_names
-- - Future signups will always have names
--
-- Rollback (if needed):
-- This migration is idempotent and safe. However, if rollback is needed:
-- 1. Restore previous get_user_profile_for_audit() from baseline_schema.sql
-- 2. Restore previous handle_new_user() from baseline_schema.sql
-- 3. Data changes (UPDATE statements) cannot be rolled back
--
-- Testing:
-- 1. Check profiles: SELECT COUNT(*) FROM profiles WHERE name IS NULL;
-- 2. Check audit_logs: SELECT COUNT(*) FROM audit_logs WHERE user_name IS NULL;
-- 3. Create new user and verify name is set
-- 4. Modify data and verify audit_logs.user_name is not NULL
