# Multi-Tenancy 전환 종합 계획서

**⚠️ 상태: 계획 단계 (미구현)**

**작성일**: 2025-09-28
**최종 업데이트**: 2025-11-07 (시니어 개발자 피드백 반영)
**대상 시스템**: 의료 스케줄링 시스템 (Medical Scheduling System)
**현재 상태**: 단일 기관용 (Single Tenancy)
**목표**: 다기관 지원 시스템 (Multi-Tenancy)
**개발 방식**: 개인 프로젝트 (바이브 코딩 - 시간 날 때마다 진행)

---

## 📋 시니어 개발자 피드백 반영 사항 (2025-11-07)

### ✅ 주요 개선사항 요약

1. **사용자-조직 관계 모델 확정 (1:N 유지)**
   - 한국 의료법 규정 반영: 의료인은 하나의 의료기관에만 소속
   - `profiles` 테이블에 `organization_id` 유지 (Junction 테이블 불필요)
   - 초기 계획의 타당성 재확인

2. **Super Admin 권한 제한 (HIPAA 규정 준수 강화)**
   - 환자 의료 정보(PHI) 접근 원칙적 금지
   - 시스템 운영 및 기관 관리에만 집중
   - 비상시 접근을 위한 'Break-Glass' 절차 추가

3. **초대(Invitation) 기반 온보딩 플로우 추가**
   - `invitations` 테이블 신설
   - 기관 관리자가 이메일로 팀원 초대
   - 보안 및 사용자 경험 향상

4. **자원 격리 및 제어 (Quota, Rate Limiting) 구체화**
   - 조직별 사용자/환자 수 제한 API 레벨 강제
   - 'Noisy Neighbor' 문제 방지
   - Rate Limiting 정책 명시

5. **오프보딩 (조직 비활성화/탈퇴) 정책 추가**
   - 논리적 삭제 (Soft Deletion)
   - 90일 보존 기간
   - 영구 삭제 절차 명시

6. **테스트 계획 구체화**
   - 데이터 격리 검증 시나리오 상세화
   - Super Admin PHI 접근 차단 테스트 추가
   - 구체적인 테스트 케이스 제시

---

## 목차

1. [개요](#개요)
2. [의사결정 사항 (확정)](#의사결정-사항-확정)
3. [관리자 계층 구조](#관리자-계층-구조)
4. [데이터베이스 스키마 변경사항](#1-데이터베이스-스키마-변경사항)
5. [인증 및 권한 관리](#2-인증-및-권한-관리)
6. [데이터 격리 전략](#3-데이터-격리-전략)
7. [UI/UX 변경사항](#4-uiux-변경사항)
8. [API 및 서비스 레이어 변경](#5-api-및-서비스-레이어-변경)
9. [마이그레이션 전략](#6-마이그레이션-전략)
10. [성능 고려사항](#7-성능-고려사항)
11. [보안 고려사항](#8-보안-고려사항)
12. **[신규]** [자원 격리 및 Quota 관리](#9-자원-격리-및-quota-관리-신규)
13. **[신규]** [오프보딩 및 데이터 처리 정책](#10-오프보딩-및-데이터-처리-정책-신규)
14. [구현 체크리스트](#구현-체크리스트)
15. [잠재적 위험 요소](#잠재적-위험-요소)
16. [바이브 코딩 가이드](#바이브-코딩-가이드)

---

## 개요

### 현재 상황
- **Tech Stack**: Next.js 15, TypeScript, Supabase (PostgreSQL), React Query
- **현재 구조**: 단일 기관용 시스템
- **주요 기능**: 환자 관리, 스케줄 관리, 실시간 업데이트, 역할 기반 접근 제어

### 목표
여러 병원/의료기관이 **데이터 격리를 보장하면서** 동일한 애플리케이션을 사용할 수 있도록 시스템 전환

### 핵심 요구사항
1. **완벽한 데이터 격리**: 기관 A의 사용자는 기관 B의 데이터를 절대 볼 수 없음
2. **HIPAA Compliance**: 의료 데이터 보안 규정 준수
3. **성능 유지**: Multi-tenancy로 인한 성능 저하 최소화
4. **기존 사용자 보호**: 현재 사용자에게 영향 없이 전환
5. **점진적 전환**: 각 단계마다 시스템이 작동하는 상태 유지

---

## 의사결정 사항 (확정)

### ✅ 최종 결정 사항

1. **Super Admin 초기 설정 방식**
   - **결정**: 환경변수 + CLI 스크립트 조합
   - **환경변수**: `INITIAL_SUPER_ADMIN_EMAIL=admin@example.com`
   - **CLI 스크립트**: `npm run promote-super-admin -- email@example.com`

2. **기존 'admin' 역할 처리**
   - **결정**: 자동 마이그레이션 (admin → org_admin)
   - 모든 기존 'admin' 사용자는 자동으로 'org_admin'으로 전환됨
   - 첫 번째 사용자만 수동으로 'super_admin' 승격

3. **Read Only 역할**
   - **결정**: 제외 (필요 없음)
   - 개발 범위 축소로 구현 속도 향상

4. **다기관 전환 방식**
   - **결정**: 점진적 전환 (Gradual Migration)
   - 각 단계마다 기존 기능이 작동하는 상태 유지
   - 문제 발생 시 이전 단계로 롤백 용이

5. **개발 방식**
   - **결정**: 개인 프로젝트 (바이브 코딩)
   - 타임라인 대신 체크리스트 중심
   - 시간 날 때마다 진행

6. **사용자-조직 관계 모델 (시니어 피드백 반영)** ✅
   - **결정**: 1:N 관계 유지 (사용자는 하나의 조직에만 소속)
   - **근거**: 한국 의료법 규정 - 의료인은 하나의 의료기관에만 소속 가능
   - **구현**: `profiles` 테이블에 `organization_id` 컬럼 유지
   - **제외**: Junction 테이블 (`user_organizations`) 불필요

---

## 관리자 계층 구조

### 최종 역할 구조

```typescript
export type UserRole =
  | 'nurse'           // 간호사 (기존)
  | 'doctor'          // 의사 (기존)
  | 'org_admin'       // 기관 관리자 (기존 'admin'에서 rename)
  | 'super_admin'     // 플랫폼 관리자 (신규 추가)
```

### 계층도

```
┌─────────────────────────────────────────────────┐
│         SUPER_ADMIN (플랫폼 관리자)              │
│  - 모든 기관 접근/관리                           │
│  - 신규 기관 생성/승인/비활성화                   │
│  - 전체 시스템 설정 및 모니터링                   │
│  - 기관 관리자 권한 부여/회수                     │
│  - 감사 로그 전체 조회                           │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│       ORG_ADMIN (기관 관리자)                    │
│  - 자신의 기관 내 모든 권한                       │
│  - 기관 내 사용자 승인/거부/관리                  │
│  - 기관 설정 변경 (근무시간, 알림 정책 등)         │
│  - 기관 내 데이터 전체 조회                       │
│  - 기관 내 감사 로그 조회                         │
│  - 기관 내 아이템/템플릿 관리                     │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────┐           ┌──────────────┐
│   DOCTOR     │           │    NURSE     │
│  (의사)       │           │   (간호사)    │
│              │           │              │
│ - 자신의      │           │ - 케어 타입별 │
│   환자 관리   │           │   환자 관리   │
│ - 스케줄 생성 │           │ - 스케줄 실행 │
└──────────────┘           └──────────────┘
```

### 권한 매트릭스

| 기능 | SUPER_ADMIN | ORG_ADMIN | DOCTOR | NURSE |
|------|-------------|-----------|---------|--------|
| **기관 관리** |
| 기관 생성/삭제 | ✅ | ❌ | ❌ | ❌ |
| 기관 설정 조회 | ✅ (모든 기관) | ✅ (자신의 기관) | ❌ | ❌ |
| 기관 설정 수정 | ✅ (모든 기관) | ✅ (자신의 기관) | ❌ | ❌ |
| 기관 활성화/비활성화 | ✅ | ❌ | ❌ | ❌ |
| **사용자 관리** |
| 사용자 승인/거부 | ✅ (모든 기관) | ✅ (자신의 기관) | ❌ | ❌ |
| 사용자 역할 변경 | ✅ (모든 기관) | ✅ (자신의 기관, ORG_ADMIN 제외) | ❌ | ❌ |
| 사용자 비활성화 | ✅ (모든 기관) | ✅ (자신의 기관) | ❌ | ❌ |
| ORG_ADMIN 권한 부여 | ✅ | ❌ | ❌ | ❌ |
| **환자 관리** |
| 환자 조회 | ✅ (모든 기관) | ✅ (기관 전체) | ✅ (자신의 환자) | ✅ (케어 타입별) |
| 환자 생성 | ✅ | ✅ | ✅ | ✅ |
| 환자 수정 | ✅ | ✅ | ✅ (자신의 환자) | ✅ (케어 타입별) |
| 환자 삭제 | ✅ | ✅ | ❌ | ❌ |
| **스케줄 관리** |
| 스케줄 조회 | ✅ (모든 기관) | ✅ (기관 전체) | ✅ (자신의 환자) | ✅ (케어 타입별) |
| 스케줄 생성 | ✅ | ✅ | ✅ | ✅ |
| 스케줄 수정 | ✅ | ✅ | ✅ (자신의 환자) | ✅ (케어 타입별) |
| 스케줄 삭제 | ✅ | ✅ | ❌ | ❌ |
| 스케줄 실행 체크 | ✅ | ✅ | ✅ | ✅ |
| **아이템 관리** |
| 아이템 조회 | ✅ (모든 기관) | ✅ (기관+공유) | ✅ (기관+공유) | ✅ (기관+공유) |
| 아이템 생성 | ✅ | ✅ | ❌ | ❌ |
| 공유 아이템 생성 | ✅ | ❌ | ❌ | ❌ |
| 아이템 수정/삭제 | ✅ | ✅ (기관 아이템만) | ❌ | ❌ |
| **감사 로그** |
| 감사 로그 조회 | ✅ (모든 기관) | ✅ (자신의 기관) | ❌ | ❌ |
| **시스템 모니터링** |
| 성능 대시보드 접근 | ✅ | ✅ (자신의 기관) | ❌ | ❌ |
| 전체 시스템 통계 | ✅ | ❌ | ❌ | ❌ |

---

## 1. 데이터베이스 스키마 변경사항

### 1.1 Organizations 테이블 생성

```sql
-- Migration: 20250928000001_create_organizations.sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- 기관 고유 코드 (e.g., "SMC", "SNUH")
  type TEXT NOT NULL CHECK (type IN ('hospital', 'clinic', 'long_term_care')),

  -- Contact & Address
  address JSONB, -- { street, city, postal_code, country }
  phone TEXT,
  email TEXT,

  -- Configuration
  settings JSONB DEFAULT '{}', -- 기관별 설정 (근무시간, 알림 정책 등)
  branding JSONB DEFAULT '{}', -- { logo_url, primary_color, secondary_color }

  -- Status & Limits
  is_active BOOLEAN DEFAULT true,
  subscription_tier TEXT DEFAULT 'basic', -- basic, professional, enterprise
  max_users INTEGER DEFAULT 50,
  max_patients INTEGER DEFAULT 1000,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_organizations_code ON organizations(code);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);
```

### 1.2 기존 테이블에 organization_id 추가

**Critical Tables (환자 데이터 격리 필수):**

```sql
-- Migration: 20250928000002_add_organization_id_to_tables.sql

-- 1. profiles 테이블
ALTER TABLE profiles
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. patients 테이블 (이미 hospital_id 컬럼 존재 - 이를 organization_id로 rename)
ALTER TABLE patients
  RENAME COLUMN hospital_id TO organization_id;

-- Foreign key constraint 추가
ALTER TABLE patients
  ADD CONSTRAINT fk_patients_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- 3. schedules 테이블 (denormalized for performance)
ALTER TABLE schedules
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. patient_schedules 테이블
ALTER TABLE patient_schedules
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 5. items 테이블 (기관별 또는 공통 아이템)
ALTER TABLE items
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN is_shared BOOLEAN DEFAULT false; -- 공통 아이템 여부

-- 6. audit_logs 테이블
ALTER TABLE audit_logs
  ADD COLUMN organization_id UUID;

-- 7. notifications 테이블
ALTER TABLE notifications
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 8. schedule_executions 테이블
ALTER TABLE schedule_executions
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
```

### 1.3 인덱스 추가 (Performance Critical)

```sql
-- Migration: 20250928000003_add_organization_indexes.sql

-- Composite indexes for filtered queries
CREATE INDEX idx_profiles_org_role ON profiles(organization_id, role);
CREATE INDEX idx_patients_org_active ON patients(organization_id, is_active);
CREATE INDEX idx_schedules_org_status ON schedules(organization_id, status);
CREATE INDEX idx_schedules_org_next_due ON schedules(organization_id, next_due_date);
CREATE INDEX idx_items_org_shared ON items(organization_id, is_shared);
CREATE INDEX idx_audit_logs_org_timestamp ON audit_logs(organization_id, timestamp DESC);
CREATE INDEX idx_notifications_org_state ON notifications(organization_id, state);

-- Ensure patient_number uniqueness per organization
CREATE UNIQUE INDEX idx_patients_org_patient_number
  ON patients(organization_id, patient_number)
  WHERE is_active = true;
```

### 1.4 PostgreSQL 세션 변수 설정 함수 (성능 최적화)

```sql
-- Migration: 20250928000004_create_session_helpers.sql

-- 세션 변수에 organization_id 저장 (RLS 성능 최적화)
CREATE OR REPLACE FUNCTION set_current_organization(org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_organization_id', org_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 세션의 organization_id 조회 헬퍼
CREATE OR REPLACE FUNCTION get_current_organization()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 사용자의 organization_id를 세션 변수에 설정하는 함수
CREATE OR REPLACE FUNCTION set_user_organization()
RETURNS void AS $$
DECLARE
  user_org_id UUID;
BEGIN
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = auth.uid();

  IF user_org_id IS NOT NULL THEN
    PERFORM set_current_organization(user_org_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.5 RLS (Row Level Security) 정책 수정

```sql
-- Migration: 20250928000005_update_rls_policies_for_multi_tenancy.sql

-- ============================================
-- 1. profiles 테이블 RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Users can only view profiles in their organization
-- 성능 최적화: 세션 변수 사용 (서브쿼리 제거)
CREATE POLICY "Users view profiles in org"
  ON profiles FOR SELECT
  USING (
    organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can manage users in their organization
CREATE POLICY "Admins manage org users"
  ON profiles FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 2. patients 테이블 RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view patients" ON patients;
DROP POLICY IF EXISTS "Users can insert patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;

-- Users can only access patients in their organization
-- 성능 최적화: 세션 변수 사용
CREATE POLICY "Users view org patients"
  ON patients FOR SELECT
  USING (
    organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    AND is_active = true
  );

-- Approved users can create patients
CREATE POLICY "Approved users create patients"
  ON patients FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Role-based update
CREATE POLICY "Users update org patients"
  ON patients FOR UPDATE
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND approval_status = 'approved'
      )
      OR (doctor_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role = 'nurse'
          AND care_type = patients.care_type
          AND approval_status = 'approved'
      )
    )
  );

-- ============================================
-- 3. schedules 테이블 RLS
-- ============================================
CREATE POLICY "Users view org schedules"
  ON schedules FOR SELECT
  USING (
    organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Approved users create schedules"
  ON schedules FOR INSERT
  WITH CHECK (
    organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles
       WHERE id = auth.uid() AND approval_status = 'approved')
    )
  );

-- ============================================
-- 4. items 테이블 RLS (공유 아이템 지원)
-- ============================================
CREATE POLICY "Users view org or shared items"
  ON items FOR SELECT
  USING (
    is_shared = true
    OR organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================
-- 5. audit_logs 테이블 RLS
-- ============================================
-- Only admins can view audit logs in their organization
CREATE POLICY "Admins view org audit logs"
  ON audit_logs FOR SELECT
  USING (
    organization_id = COALESCE(
      get_current_organization(),
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert audit logs (handled by triggers)
CREATE POLICY "System insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins create org items"
  ON items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = items.organization_id
    )
  );
```

### 1.6 데이터 무결성 보장 Triggers

```sql
-- Migration: 20250928000006_add_organization_triggers.sql

-- Auto-populate organization_id in schedules from patient
CREATE OR REPLACE FUNCTION auto_populate_schedule_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM patients
    WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedule_org_id
  BEFORE INSERT ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_schedule_org_id();

-- Prevent cross-organization data mixing
CREATE OR REPLACE FUNCTION validate_org_consistency()
RETURNS TRIGGER AS $$
DECLARE
  patient_org_id UUID;
  item_org_id UUID;
  item_is_shared BOOLEAN;
BEGIN
  -- Check patient belongs to same org
  SELECT organization_id INTO patient_org_id
  FROM patients WHERE id = NEW.patient_id;

  IF patient_org_id != NEW.organization_id THEN
    RAISE EXCEPTION 'Patient does not belong to the specified organization';
  END IF;

  -- Check item belongs to same org or is shared
  SELECT organization_id, is_shared INTO item_org_id, item_is_shared
  FROM items WHERE id = NEW.item_id;

  IF item_org_id != NEW.organization_id AND NOT item_is_shared THEN
    RAISE EXCEPTION 'Item does not belong to the specified organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedule_org_consistency
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION validate_org_consistency();
```

---

## 2. 인증 및 권한 관리

### 2.1 Role 확장

```typescript
// src/lib/database.types.ts
export type UserRole = 'nurse' | 'admin' | 'doctor' | 'super_admin'

// Super Admin: 모든 기관 관리 가능
// Admin: 자신의 기관 내 모든 권한
// Doctor/Nurse: 자신의 기관 내 제한된 권한
```

### 2.2 사용자 온보딩 플로우

```typescript
// src/types/auth.ts
export interface UserRegistration {
  email: string
  password: string
  name: string
  role: UserRole
  organizationCode?: string // 기존 기관 참여
  newOrganization?: {
    name: string
    code: string
    type: 'hospital' | 'clinic' | 'long_term_care'
  }
}

export interface OrganizationContext {
  organizationId: string
  organizationName: string
  organizationCode: string
  userRole: UserRole
  permissions: Permission[]
}
```

### 2.3 회원가입 시나리오

**시나리오 1: 기존 기관에 참여**
```typescript
// 1. 사용자가 기관 코드 입력 (e.g., "SMC")
// 2. 기관 존재 여부 확인
// 3. 회원가입 후 해당 기관의 admin 승인 대기 (approval_status: 'pending')
// 4. Admin 승인 후 사용 가능
```

**시나리오 2: 신규 기관 생성 (첫 사용자)**
```typescript
// 1. 새 기관 정보 입력 (이름, 코드, 타입)
// 2. Organizations 테이블에 기관 생성
// 3. 사용자를 첫 admin으로 등록 (approval_status: 'approved')
// 4. 즉시 사용 가능
```

### 2.4 Session & Token 관리

```typescript
// src/lib/supabase/server.ts 수정
export async function getCurrentUserWithOrg() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(id, name, code, is_active)
    `)
    .eq('id', user.id)
    .single()

  if (!profile?.organization?.is_active) {
    throw new Error('Organization is inactive')
  }

  return {
    user,
    profile,
    organizationId: profile.organization_id,
    organizationName: profile.organization.name,
    role: profile.role
  }
}
```

### 2.5 Permission 시스템

```typescript
// src/lib/auth/permissions.ts
export const PERMISSIONS = {
  // Patient Management
  'patients.view': ['nurse', 'doctor', 'admin', 'super_admin'],
  'patients.create': ['nurse', 'doctor', 'admin', 'super_admin'],
  'patients.update': ['nurse', 'doctor', 'admin', 'super_admin'],
  'patients.delete': ['admin', 'super_admin'],

  // Schedule Management
  'schedules.view': ['nurse', 'doctor', 'admin', 'super_admin'],
  'schedules.create': ['nurse', 'doctor', 'admin', 'super_admin'],
  'schedules.update': ['nurse', 'doctor', 'admin', 'super_admin'],
  'schedules.delete': ['admin', 'super_admin'],

  // User Management
  'users.view': ['admin', 'super_admin'],
  'users.approve': ['admin', 'super_admin'],
  'users.manage': ['admin', 'super_admin'],

  // Organization Management
  'organization.settings': ['admin', 'super_admin'],
  'organization.manage_all': ['super_admin'],
} as const

export function hasPermission(
  userRole: UserRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].includes(userRole)
}
```

---

## 3. 데이터 격리 전략

### 3.1 핵심 원칙

- **RLS를 통한 데이터베이스 레벨 격리**: 모든 쿼리에 organization_id가 자동으로 필터링됨
- **Application 레벨 validation**: RLS + 명시적 검증 (Defense in Depth)
- **데이터 유출 불가능**: 데이터베이스 레벨 보호

### 3.2 React Query Key 구조 변경

```typescript
// Before (Single Tenancy)
['patients'] // All patients
['schedules', userId] // User's schedules

// After (Multi Tenancy)
['patients', organizationId] // Organization's patients
['schedules', organizationId, userId] // User's schedules in org
['schedules', organizationId, 'today'] // Today's schedules in org
['items', organizationId, 'shared'] // Org items + shared items
```

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  // Patients
  patients: (organizationId: string) => ['patients', organizationId] as const,
  patient: (organizationId: string, patientId: string) =>
    ['patients', organizationId, patientId] as const,

  // Schedules
  schedules: (organizationId: string) => ['schedules', organizationId] as const,
  schedulesToday: (organizationId: string) =>
    ['schedules', organizationId, 'today'] as const,
  schedulesByPatient: (organizationId: string, patientId: string) =>
    ['schedules', organizationId, 'patient', patientId] as const,

  // Items
  items: (organizationId: string) => ['items', organizationId] as const,
  itemsWithShared: (organizationId: string) =>
    ['items', organizationId, 'shared'] as const,

  // Users
  users: (organizationId: string) => ['users', organizationId] as const,
}
```

### 3.3 Service Layer 수정

```typescript
// src/services/patientService.ts 수정 예시

export const patientService = {
  async getAll(
    supabase?: SupabaseClient,
    userContext?: {
      organizationId: string // 필수로 변경
      role?: string
      careType?: string | null
      showAll?: boolean
      userId?: string
    }
  ): Promise<Patient[]> {
    const client = supabase || createClient()

    // RLS가 organization_id를 자동으로 필터링
    // 하지만 명시적으로 추가하면 더 안전

    let query = client
      .from('patients')
      .select(`*, doctor:profiles!doctor_id(id, name)`)
      .eq('is_active', true)

    // Role-based filtering (기존 로직 유지)
    if (userContext && !userContext.showAll) {
      if (userContext.role === 'doctor' && userContext.userId) {
        query = query.eq('doctor_id', userContext.userId)
      } else if (userContext.role === 'nurse' && userContext.careType) {
        query = query.eq('care_type', userContext.careType)
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(item => toCamelCase(item) as Patient)
  },

  async create(
    input: PatientCreateInput,
    organizationId: string, // 명시적 파라미터 추가
    supabase?: SupabaseClient
  ): Promise<Patient> {
    const client = supabase || createClient()

    const insertData = {
      ...toSnakeCase(PatientCreateSchema.parse(input)),
      organization_id: organizationId // 명시적으로 설정
    }

    const { data, error } = await client
      .from('patients')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error
    return toCamelCase(data) as Patient
  }
}
```

### 3.4 Real-time Subscription 격리

```typescript
// src/hooks/useRealtimeEvents.ts 수정
export function useRealtimePatients(organizationId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to changes for this organization only
    const channel = supabase
      .channel(`patients:org:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `organization_id=eq.${organizationId}` // Critical filter
        },
        (payload) => {
          console.log('Patient change:', payload)
          // Invalidate with organization-specific key
          queryClient.invalidateQueries({
            queryKey: queryKeys.patients(organizationId)
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [organizationId, queryClient])
}
```

---

## 4. UI/UX 변경사항

### 4.1 회원가입 플로우 개선

```typescript
// src/app/auth/register/page.tsx
<Form>
  {/* Step 1: 기관 선택 */}
  <RadioGroup>
    <Radio value="join">기존 기관에 참여</Radio>
    <Radio value="create">새 기관 만들기</Radio>
  </RadioGroup>

  {mode === 'join' && (
    <Input
      label="기관 코드"
      placeholder="SMC, SNUH 등"
      onBlur={validateOrganizationCode}
    />
  )}

  {mode === 'create' && (
    <>
      <Input label="기관 이름" />
      <Input label="기관 코드 (고유)" />
      <Select label="기관 유형" options={['병원', '의원', '요양시설']} />
    </>
  )}

  {/* Step 2: 사용자 정보 */}
  <Input label="이름" />
  <Input label="이메일" />
  <Input label="비밀번호" />
  <Select label="역할" options={['간호사', '의사', '관리자']} />
</Form>
```

### 4.2 Organization Context Provider

```typescript
// src/providers/organization-provider.tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

interface OrganizationContextType {
  organizationId: string
  organizationName: string
  organizationCode: string
  userRole: UserRole
  isLoading: boolean
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: userWithOrg, isLoading } = useQuery({
    queryKey: ['currentUserWithOrg'],
    queryFn: getCurrentUserWithOrg,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <LoadingScreen />
  if (!userWithOrg) return <RedirectToLogin />

  return (
    <OrganizationContext.Provider
      value={{
        organizationId: userWithOrg.organizationId,
        organizationName: userWithOrg.organizationName,
        organizationCode: userWithOrg.profile.organization.code,
        userRole: userWithOrg.role,
        isLoading: false,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}
```

### 4.3 네비게이션 바에 기관 정보 표시

```typescript
// src/components/layout/navbar.tsx
export function Navbar() {
  const { organizationName, organizationCode } = useOrganization()

  return (
    <nav className="border-b">
      <div className="flex items-center justify-between">
        <Logo />

        {/* Organization Badge */}
        <Badge variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span>{organizationName}</span>
          <span className="text-muted-foreground">({organizationCode})</span>
        </Badge>

        <UserMenu />
      </div>
    </nav>
  )
}
```

---

## 5. API 및 서비스 레이어 변경

### 5.1 Middleware에서 Organization Context 주입

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // ... (기존 auth 로직)

  // Fetch organization context if authenticated
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, approval_status')
      .eq('id', session.user.id)
      .single()

    // Check if user is approved
    if (profile?.approval_status !== 'approved') {
      if (!request.nextUrl.pathname.startsWith('/auth/pending')) {
        return NextResponse.redirect(new URL('/auth/pending', request.url))
      }
    }

    // Inject organization context into headers
    if (profile) {
      response.headers.set('X-Organization-Id', profile.organization_id)
      response.headers.set('X-User-Role', profile.role)
    }
  }

  return response
}
```

### 5.2 API Route에서 Organization Context 추출 (보안 강화)

```typescript
// src/app/api/patients/route.ts
// 개선: 헤더 대신 세션에서 직접 organization_id 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 사용자의 프로필에서 직접 organization_id와 role을 조회 (헤더 대신)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role, approval_status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 세션 변수 설정 (RLS 성능 최적화)
    await supabase.rpc('set_current_organization', {
      org_id: profile.organization_id
    })

    // 서비스 호출 시 조회한 신뢰할 수 있는 컨텍스트를 전달
    const patients = await patientService.getAll(supabase, {
      organizationId: profile.organization_id,
      role: profile.role as UserRole,
      userId: user.id,
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 사용자의 organization_id 조회 (헤더 대신 DB에서 직접)
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, approval_status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 세션 변수 설정
    await supabase.rpc('set_current_organization', {
      org_id: profile.organization_id
    })

    const body = await request.json()
    const patient = await patientService.create(
      body,
      profile.organization_id,
      supabase
    )

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    )
  }
}
```

**개선 사항:**
1. ✅ **헤더 의존성 제거**: 미들웨어가 주입한 헤더 대신 DB에서 직접 조회
2. ✅ **보안 강화**: 인증된 사용자 세션 기반으로만 organization_id 획득
3. ✅ **성능 최적화**: 세션 변수 설정으로 RLS 서브쿼리 제거
4. ✅ **명확한 에러 처리**: approval_status 검증 추가

---

## 6. 마이그레이션 전략

### Phase 1: 데이터베이스 준비 (1-2주)

**Step 1: Organizations 테이블 생성**
```bash
supabase migration new create_organizations
supabase migration new add_organization_id_to_tables
supabase migration new add_organization_indexes
```

**Step 2: 기존 데이터 마이그레이션 (검증 추가)**
```sql
-- Migration: 20250928000007_migrate_existing_data.sql

-- 1. Create default organization for existing data
INSERT INTO organizations (id, name, code, type, is_active)
VALUES (
  'default-org-uuid',
  'Default Hospital',
  'DEFAULT',
  'hospital',
  true
);

-- 2. Update all existing users to belong to default org
UPDATE profiles
SET organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;

-- 3. Update all existing patients
UPDATE patients
SET organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;

-- 4. Update all existing schedules
UPDATE schedules s
SET organization_id = p.organization_id
FROM patients p
WHERE s.patient_id = p.id AND s.organization_id IS NULL;

-- 5. Update all items to be shared
UPDATE items
SET is_shared = true, organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;

-- ============================================
-- 검증 단계 (CRITICAL: NOT NULL 설정 전 반드시 실행)
-- ============================================

-- Null 값 확인 쿼리
DO $$
DECLARE
  null_profiles_count INTEGER;
  null_patients_count INTEGER;
  null_schedules_count INTEGER;
BEGIN
  -- profiles 체크
  SELECT COUNT(*) INTO null_profiles_count
  FROM profiles WHERE organization_id IS NULL;

  -- patients 체크
  SELECT COUNT(*) INTO null_patients_count
  FROM patients WHERE organization_id IS NULL;

  -- schedules 체크
  SELECT COUNT(*) INTO null_schedules_count
  FROM schedules WHERE organization_id IS NULL;

  -- 결과 출력
  RAISE NOTICE 'Profiles with NULL organization_id: %', null_profiles_count;
  RAISE NOTICE 'Patients with NULL organization_id: %', null_patients_count;
  RAISE NOTICE 'Schedules with NULL organization_id: %', null_schedules_count;

  -- Null 값이 있으면 에러 발생
  IF null_profiles_count > 0 OR null_patients_count > 0 OR null_schedules_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: NULL organization_id found';
  END IF;

  RAISE NOTICE 'Migration validation passed!';
END $$;

-- 6. Make organization_id NOT NULL after validation (안전하게 진행)
ALTER TABLE profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE patients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedules ALTER COLUMN organization_id SET NOT NULL;

RAISE NOTICE 'NOT NULL constraints added successfully';
```

**마이그레이션 안전성 체크리스트:**
- [ ] 백업 완료
- [ ] Staging 환경 테스트 완료
- [ ] 검증 쿼리 통과 확인
- [ ] Rollback 스크립트 준비
- [ ] 모든 NULL 값 처리 확인

### Phase 2: RLS 정책 업데이트 (1주)

```bash
supabase migration new update_rls_policies_for_multi_tenancy
```

### Phase 3: 코드 변경 (2-3주)

**Week 1: Backend & Services**
- [ ] Update database types
- [ ] Add organizationId to service function signatures
- [ ] Update middleware for organization context
- [ ] Update API routes

**Week 2: Frontend Components**
- [ ] Create OrganizationProvider
- [ ] Update React Query keys
- [ ] Modify service calls to use organization context
- [ ] Update real-time subscriptions

**Week 3: UI/UX**
- [ ] Add registration flow
- [ ] Add organization badge to navbar
- [ ] Add admin approval workflow UI
- [ ] Add organization settings page

### Phase 4: 테스팅 (2주)

**Test Cases:**
1. Data Isolation: User A in Org 1 cannot see User B's data in Org 2
2. Cross-Org Prevention: Cannot create schedule with patient from different org
3. Shared Items: Verify shared items visible across orgs
4. Role Permissions: Test all permission combinations
5. Real-time Isolation: Events only fire for same organization
6. Cache Isolation: Query cache correctly scoped to organization

### Phase 5: 점진적 배포 (1-2주)

```bash
# 1. Deploy to staging with default organization
# 2. Test with real users
# 3. Create first real multi-org setup (beta customers)
# 4. Monitor for 1 week
# 5. Full production rollout
```

---

## 7. 성능 고려사항

### 7.1 RLS 성능 최적화 (PostgreSQL 세션 변수)

**문제점:**
- RLS 정책 내 서브쿼리 `(SELECT organization_id FROM profiles WHERE id = auth.uid())`는 각 row 조회마다 실행될 수 있음
- 대규모 데이터셋에서 성능 저하 가능

**해결책:**
```typescript
// src/lib/supabase/session-context.ts
export async function setOrganizationContext(
  supabase: SupabaseClient,
  userId: string
) {
  // 사용자의 organization_id를 세션 변수에 설정
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if (profile?.organization_id) {
    await supabase.rpc('set_current_organization', {
      org_id: profile.organization_id
    })
  }

  return profile?.organization_id
}

// API Route에서 사용 예시
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 세션 변수 설정 (트랜잭션당 한 번만 실행)
  const orgId = await setOrganizationContext(supabase, user.id)

  // 이후 모든 쿼리는 세션 변수를 사용 (서브쿼리 없음)
  const patients = await patientService.getAll(supabase, {
    organizationId: orgId,
    userId: user.id,
  })

  return NextResponse.json(patients)
}
```

**성능 향상:**
- ✅ 트랜잭션당 한 번의 profiles 조회로 감소
- ✅ RLS 정책에서 서브쿼리 제거
- ✅ 대규모 데이터셋에서 쿼리 속도 향상

### 7.2 인덱싱 전략

```sql
-- Critical indexes for multi-tenancy performance

-- Primary filters (organization_id first)
CREATE INDEX idx_patients_org_active ON patients(organization_id, is_active);
CREATE INDEX idx_schedules_org_status_due ON schedules(organization_id, status, next_due_date);

-- Composite indexes for common queries
CREATE INDEX idx_schedules_org_patient ON schedules(organization_id, patient_id);

-- Partial indexes for active records
CREATE INDEX idx_patients_org_active_partial
  ON patients(organization_id)
  WHERE is_active = true;
```

### 7.3 Query 최적화

```typescript
// Denormalize organization_id in child tables for performance

// Bad (requires JOIN)
SELECT s.*
FROM schedules s
JOIN patients p ON s.patient_id = p.id
WHERE p.organization_id = 'org-uuid'

// Good (direct filter)
SELECT s.*
FROM schedules s
WHERE s.organization_id = 'org-uuid'
```

### 7.4 Caching 전략

```typescript
// Organization-specific cache keys prevent cache pollution
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      cacheTime: 5 * 60 * 1000,
    },
  },
})
```

---

## 8. 보안 고려사항

### 8.1 Organization ID Tampering 방지

```typescript
// ❌ NEVER trust client-provided organization_id
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { organizationId } = body // ❌ DANGEROUS!
}

// ✅ ALWAYS get organization_id from authenticated session
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  await patientService.create(body, profile.organization_id, supabase)
}
```

### 8.2 RLS는 최후의 방어선

```sql
-- RLS prevents data leaks even if application code has bugs
-- Policy: organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
```

### 8.3 HIPAA Compliance 고려사항

**필수 요구사항:**
1. **데이터 암호화**: At-rest (Supabase 제공), In-transit (HTTPS)
2. **Audit Logging**: 모든 환자 데이터 접근 기록
3. **Access Control**: Role-based permissions
4. **Data Backup**: Organization별 백업 전략
5. **Business Associate Agreement (BAA)**: Supabase와 체결 필요

---

## 구현 체크리스트

> **Note**: 타임라인 대신 체크리스트 중심으로 작성. 개인 프로젝트이므로 시간 날 때마다 진행.

### Phase 1: Database Foundation

#### 1.1 Organizations 테이블
```bash
□ organizations 테이블 생성
□ 테스트: SELECT * FROM organizations 작동 확인
```

#### 1.2 organization_id 컬럼 추가
```bash
□ profiles 테이블에 organization_id 추가 (nullable)
□ patients 테이블 hospital_id → organization_id rename
□ schedules 테이블에 organization_id 추가 (nullable)
□ items 테이블에 organization_id 추가 + is_shared 컬럼
□ patient_schedules 테이블에 organization_id 추가
□ notifications 테이블에 organization_id 추가
□ schedule_executions 테이블에 organization_id 추가
□ audit_logs 테이블에 organization_id 추가
□ 테스트: 기존 환자 데이터 조회 작동 확인
```

#### 1.3 Default Organization 생성 & 데이터 마이그레이션
```bash
□ Default Hospital 조직 생성 (UUID 동적 생성)
□ 모든 기존 profiles에 organization_id 할당
□ 모든 기존 patients에 organization_id 할당
□ 모든 기존 schedules에 organization_id 할당
□ 모든 기존 items을 공유 아이템으로 설정
□ 검증 쿼리: NULL organization_id 개수 확인 (0이어야 함)
□ NOT NULL constraint 추가
□ 데이터 일관성 검증 (schedules-patients organization 일치)
```

#### 1.4 UserRole 확장
```bash
□ super_admin, org_admin enum 값 추가
□ 기존 'admin' → 'org_admin' 자동 마이그레이션
□ is_super_admin 컬럼 추가 (선택적)
□ Trigger: role 변경 시 is_super_admin 동기화
□ 테스트: Role enum 값 확인
```

#### 1.5 인덱스 생성
```bash
□ idx_patients_org_active
□ idx_schedules_org_status_due
□ idx_profiles_org_role
□ idx_items_org_shared
□ idx_audit_logs_org_timestamp
□ idx_notifications_org_state
□ idx_patients_org_patient_number (UNIQUE)
□ 테스트: EXPLAIN ANALYZE로 인덱스 사용 확인
```

---

### Phase 2: RLS Policies

#### 2.1 세션 변수 헬퍼 함수
```bash
□ set_current_organization() 함수 생성
□ get_current_organization() 함수 생성
□ set_user_organization() 함수 생성
□ 테스트: RPC 호출 작동 확인
```

#### 2.2 profiles 테이블 RLS
```bash
□ Super Admin: 모든 프로필 조회 정책
□ Org Admin: 기관 내 프로필 조회 정책
□ Org Admin: 기관 내 사용자 관리 (org_admin/super_admin 제외)
□ 일반 사용자: 자신의 프로필만 수정
□ 테스트: 다른 기관 프로필 접근 차단 확인
```

#### 2.3 patients 테이블 RLS
```bash
□ Super Admin: 모든 환자 조회
□ Org Admin: 기관 환자 전체 조회
□ Doctor: 자신의 환자 + organization 체크
□ Nurse: 케어 타입별 + organization 체크
□ 테스트: Cross-organization 접근 차단 확인
```

#### 2.4 schedules 테이블 RLS
```bash
□ Super Admin: 모든 스케줄 조회
□ Org Admin: 기관 스케줄 전체 조회
□ Doctor/Nurse: 기존 필터링 + organization 체크
□ 테스트: 다른 기관 스케줄 접근 차단
```

#### 2.5 organizations 테이블 RLS
```bash
□ Super Admin: 모든 기관 관리
□ Org Admin: 자신의 기관만 조회/수정
□ 일반 사용자: 자신의 기관 정보만 조회
□ 테스트: 기관 설정 수정 권한 확인
```

#### 2.6 items 테이블 RLS
```bash
□ 사용자: 기관 아이템 + 공유 아이템 조회
□ Org Admin: 기관 아이템 생성
□ Super Admin: 공유 아이템 생성
□ 테스트: is_shared 로직 확인
```

#### 2.7 audit_logs 테이블 RLS
```bash
□ Super Admin: 모든 감사 로그 조회
□ Org Admin: 기관 감사 로그 조회
□ 테스트: 로그 격리 확인
```

#### 2.8 notifications, schedule_executions RLS
```bash
□ notifications 테이블 RLS 정책 추가
□ schedule_executions 테이블 RLS 정책 추가
□ patient_schedules 테이블 RLS 정책 추가
□ 테스트: 모든 테이블 RLS 활성화 확인
```

---

### Phase 3: Authentication & Authorization

#### 3.1 Super Admin 초기 설정
```bash
□ 환경변수 추가: INITIAL_SUPER_ADMIN_EMAIL
□ 앱 시작 시 자동 Super Admin 생성 로직
□ CLI 스크립트: scripts/promote-super-admin.ts 생성
  - 사용법: npm run promote-super-admin -- email@example.com
□ 테스트: 환경변수로 Super Admin 생성 확인
□ 테스트: CLI로 Super Admin 승격 확인
```

#### 3.2 Permission 시스템 업데이트
```typescript
□ PERMISSIONS 객체 확장 (super_admin, org_admin 추가)
□ hasPermission() 함수 업데이트
□ isOrgAdmin() 헬퍼 추가
□ isSuperAdmin() 헬퍼 추가
□ 권한 매트릭스 문서화
□ 테스트: 모든 권한 조합 검증
```

---

### Phase 4: Service Layer

#### 4.1 Context 패턴 도입
```bash
□ ServiceContext 인터페이스 정의
□ getCurrentOrganizationId() 헬퍼 함수
□ getAuthContext() 함수 (user + org + role 한 번에)
□ 테스트: Context 자동 주입 확인
```

#### 4.2 patientService 업데이트
```bash
□ getAll() - organizationId 필터링 추가 (optional 시작)
□ create() - organizationId 명시적 설정
□ update() - organization 일치 검증
□ delete() - soft delete + organization 체크
□ 테스트: 다른 기관 환자 수정 차단
□ 테스트: 기존 코드 하위 호환성 확인
```

#### 4.3 scheduleService 업데이트
```bash
□ getAll() - organizationId 필터링
□ getTodayChecklist() - organizationId 필터링
□ create() - organizationId 자동 채우기 (trigger 활용)
□ update() - organization 일치 검증
□ 테스트: schedules-patients organization 일치 확인
```

#### 4.4 itemService 업데이트
```bash
□ getAll() - 기관 아이템 + 공유 아이템 필터링
□ create() - organizationId 설정 또는 is_shared
□ 테스트: 공유 아이템 조회 확인
```

---

### Phase 5: API Routes

#### 5.1 Organization Context 주입
```bash
□ getAuthContext() 헬퍼 함수 생성
□ 세션 변수 설정 (set_current_organization RPC 호출)
□ 모든 API에서 재사용 가능한 패턴 확립
```

#### 5.2 API Routes 업데이트
```bash
□ /api/patients GET - organization context 주입
□ /api/patients POST - organization context 주입
□ /api/schedules GET - organization context 주입
□ /api/schedules POST - organization context 주입
□ /api/items GET - organization context 주입
□ /api/items POST - organization context 주입
□ 테스트: Postman/Thunder Client로 API 호출 검증
□ 테스트: 다른 기관 데이터 접근 차단 확인
```

#### 5.3 Super Admin 전용 API
```bash
□ /api/admin/organizations GET - 모든 기관 조회
□ /api/admin/organizations POST - 기관 생성
□ /api/admin/organizations/:id PUT - 기관 수정
□ /api/admin/users GET - 모든 사용자 조회 (org 필터링)
□ 테스트: Super Admin만 접근 가능 확인
```

---

### Phase 6: Frontend

#### 6.1 OrganizationProvider
```bash
□ OrganizationProvider 컴포넌트 생성
□ useOrganization() hook 생성
□ getCurrentUserWithOrg() 함수 수정
□ _app.tsx에 Provider 추가
□ 테스트: Context 값 콘솔 출력 확인
```

#### 6.2 React Query Keys 업데이트
```bash
□ src/lib/query-keys.ts 파일 생성 (중앙화)
□ queryKeys.patients(organizationId) 정의
□ queryKeys.schedules(organizationId) 정의
□ queryKeys.items(organizationId) 정의
□ 모든 useQuery 호출부 업데이트 (점진적)
  - Dashboard
  - Patients 페이지
  - Schedules 페이지
□ 테스트: 캐시 키 중복 없는지 확인
□ 테스트: 기관 전환 시 캐시 무효화 확인
```

#### 6.3 Real-time Subscription 격리
```bash
□ useRealtimePatients - organizationId 필터 추가
□ useRealtimeSchedules - organizationId 필터 추가
□ 채널 이름에 organizationId 포함
□ 테스트: 다른 기관 이벤트 수신 안 되는지 확인
```

---

### Phase 7: UI/UX

#### 7.1 네비게이션 바 업데이트
```bash
□ 기관 이름 표시 (Badge 컴포넌트)
□ Super Admin일 때 "플랫폼 관리" 메뉴 추가
□ Org Admin일 때 "기관 관리" 메뉴 추가
□ 역할별 메뉴 표시/숨김 처리
```

#### 7.2 Super Admin 페이지
```bash
□ /super-admin 페이지 생성
□ 전체 기관 목록 표시 (OrganizationsList 컴포넌트)
□ 기관 생성 폼
□ 기관 수정/비활성화 UI
□ 전체 시스템 통계 대시보드
□ 테스트: Super Admin만 접근 가능 확인
```

#### 7.3 Org Admin 페이지 개선
```bash
□ /admin 페이지 리팩토링
□ 사용자 승인 대기 목록 (PendingUsersTable)
□ 사용자 역할 변경 UI
□ 기관 설정 (근무시간, 알림 정책)
□ 기관 통계 (OrganizationStatistics)
□ 감사 로그 조회
□ 테스트: Org Admin 권한 확인
```

#### 7.4 회원가입 플로우
```bash
□ 기관 선택 라디오 버튼 (기존 참여 vs 신규 생성)
□ 기관 코드 입력 및 검증 API
□ 신규 기관 생성 폼 (이름, 코드, 타입)
□ 승인 대기 페이지 (/auth/pending)
□ 테스트: 회원가입 후 올바른 organization_id 할당 확인
□ 테스트: 기관 코드 검증 작동 확인
```

#### 7.5 대시보드 수정 (Transparent)
```bash
□ useOrganization() hook으로 organizationId 가져오기
□ 기존 필터링 로직 유지
□ 테스트: 기능 변화 없는지 확인
```

---

### Phase 8: Testing & Validation

#### 8.1 데이터 격리 테스트
```bash
□ 테스트 기관 2개 생성 (Org A, Org B)
□ 각 기관에 테스트 사용자 생성
□ Org A 사용자가 Org B 환자 조회 차단 확인
□ Org A 사용자가 Org B 환자 수정 차단 확인
□ API 직접 호출로 우회 시도 차단 확인
□ Real-time 이벤트 격리 확인
```

#### 8.2 권한 테스트
```bash
□ Super Admin 권한 매트릭스 검증 (모든 기능)
□ Org Admin 권한 매트릭스 검증
□ Org Admin이 다른 Org Admin 수정 차단 확인
□ Doctor/Nurse 권한 변경 없는지 확인
□ 권한 없는 페이지 접근 시 리다이렉트 확인
```

#### 8.3 성능 테스트
```bash
□ 대용량 데이터 생성 (10,000+ 환자)
□ 환자 목록 조회 속도 측정 (<1초)
□ EXPLAIN ANALYZE로 쿼리 플랜 확인
□ 세션 변수 효과 측정 (서브쿼리 제거 확인)
□ 대시보드 로딩 속도 확인
□ Real-time 구독 성능 확인
```

#### 8.4 마이그레이션 테스트
```bash
□ Staging 환경에서 전체 마이그레이션 실행
□ 데이터 무결성 검증 쿼리 통과 확인
□ 기존 기능 회귀 테스트 (환자 관리, 스케줄 관리)
□ 롤백 스크립트 테스트
```

---

### Phase 9: 배포 준비

#### 9.1 환경변수 설정
```bash
□ Production 환경변수 설정
  - INITIAL_SUPER_ADMIN_EMAIL
  - 기존 Supabase 키들
□ Staging 환경 테스트
□ .env.example 업데이트
```

#### 9.2 데이터 백업
```bash
□ 전체 데이터베이스 백업
  - pg_dump 실행
  - 백업 파일 안전한 곳에 보관 (S3, Google Drive 등)
□ 롤백 스크립트 준비 및 검증
□ 긴급 연락 체계 확립 (혼자지만 체크리스트 필요)
```

#### 9.3 마이그레이션 실행
```bash
□ Production 마이그레이션 실행
□ 검증 쿼리로 데이터 무결성 확인
□ Super Admin 설정 (환경변수 또는 CLI)
□ 전체 기능 Smoke Test
□ 모니터링 대시보드 확인
```

---

## 점진적 전환의 의미

### 빅뱅 방식 vs 점진적 전환

**빅뱅 방식 (Big Bang Deployment)**:
```sql
-- 한 번에 모든 것 변경
-- 문제 생기면 전체 시스템 다운
-- 롤백 어려움
```

**점진적 전환 (Gradual Migration)** ⭐ 권장:
```sql
-- Step 1: organization_id 컬럼만 추가 (nullable, RLS 비활성)
-- 애플리케이션은 아직 organization_id 사용 안 함
-- → 기존 기능 그대로 작동 ✅

-- Step 2: 데이터 마이그레이션 (organization_id 채우기)
-- 여전히 애플리케이션은 organization_id 무시
-- → 기존 기능 그대로 작동 ✅

-- Step 3: RLS 정책 추가 (하지만 fallback 로직 포함)
CREATE POLICY "Users view patients"
  ON patients FOR SELECT
  USING (
    -- 새 방식: organization_id 체크
    organization_id = get_current_organization()
    OR
    -- 기존 방식: organization_id가 NULL이면 모두 허용 (임시)
    organization_id IS NULL
  );
-- → 기존 기능 그대로 작동 ✅

-- Step 4: 애플리케이션 코드에서 organization_id 사용 시작
-- 신규 데이터는 organization_id 포함
-- 기존 데이터(organization_id NULL)는 여전히 접근 가능
-- → 점진적으로 multi-tenancy 적용 ✅

-- Step 5: 모든 데이터 검증 후 NOT NULL 제약 추가
-- Step 6: Fallback 로직 제거 (완전한 multi-tenancy)
```

**핵심 차이점**:
- **빅뱅**: 한 번에 모든 것 변경 → 문제 생기면 전체 시스템 다운
- **점진적**: 각 단계마다 기존 기능이 작동하는 상태 유지 → 문제 생기면 해당 단계만 롤백

### 혼자 개발하는 경우의 장점

```typescript
// 예시: 점진적 Service Layer 마이그레이션

// Step 1: organizationId 파라미터 추가 (optional)
async getAll(
  supabase?: SupabaseClient,
  userContext?: {
    organizationId?: string  // 아직 optional
    role?: string
    userId?: string
  }
): Promise<Patient[]> {
  let query = client.from('patients').select('*')

  // organizationId가 있으면 필터링, 없으면 전체 조회
  if (userContext?.organizationId) {
    query = query.eq('organization_id', userContext.organizationId)
  }

  return query
}

// 이 상태에서도 기존 코드는 작동함! ✅
// 나중에 organizationId를 required로 바꾸면 됨
```

**개인 프로젝트 이점**:
- ✅ 오늘은 DB만 수정하고 멈춰도 앱이 작동함
- ✅ 내일은 Service 레이어만 수정해도 앱이 작동함
- ✅ 각 단계를 검증하면서 진행 가능
- ✅ 잘못되면 바로 전 단계로 되돌리기 쉬움
- ✅ 시간 날 때마다 조금씩 진행 가능

---

## 10. 잠재적 위험 요소

### Risk 1: 데이터 유출 (Cross-Organization Data Leak)

**Severity: CRITICAL**

**완화 방안:**
- Automated testing for data isolation
- Paranoid validation in critical operations
- RLS as last line of defense

### Risk 2: 마이그레이션 중 데이터 손실

**Severity: HIGH**

**완화 방안:**
- Full backup before migration
- Verify all data migrated BEFORE making NOT NULL
- Test migration on staging first
- Have rollback script ready

### Risk 3: 성능 저하

**Severity: MEDIUM**

**완화 방안:**
- Strategic indexing
- Query optimization
- Cache warming for large organizations

### Risk 4: User Confusion (잘못된 기관 선택)

**Severity: MEDIUM**

**완화 방안:**
- Clear validation and error messages
- Allow super admin to reassign users (emergency)

### Risk 5: Subscription & Quota 관리

**Severity: LOW**

**완화 방안:**
- Enforce limits at application level
- Soft warnings before hard limits
- Upgrade prompts

---

## 결론 및 권장사항

### 핵심 권장사항

1. **RLS를 신뢰하되 검증하라**: RLS + application 레벨 검증 (Defense in Depth)
2. **점진적 마이그레이션**: 한 번에 모든 것을 바꾸지 말고 단계별로 진행
3. **철저한 테스팅**: 특히 데이터 격리에 대한 자동화된 테스트 필수
4. **모니터링 우선**: 배포 전에 모니터링 시스템 구축
5. **Rollback Plan**: 항상 이전 상태로 돌아갈 수 있는 계획 보유

### 예상 타임라인

- **Phase 1 (Critical Foundation)**: 4-6주
- **Phase 2 (Core Features)**: 3-4주
- **Phase 3 (Enhanced Features)**: 2-3주
- **Phase 4 (Polish)**: 2주
- **Total**: **11-15주 (약 3-4개월)**

### 예상 리소스

- **Backend Developer**: 1-2명 (DB/API)
- **Frontend Developer**: 1명 (UI/UX)
- **QA**: 테스트 자동화 + 수동 테스트
- **Timeline**: 3-4개월 full-time development

### 다음 단계

1. ✅ **이 문서 검토 및 팀 승인**
2. Phase 1 세부 task 분해 (Jira/Linear 티켓 생성)
3. POC 구현 (작은 기능으로 multi-tenancy 검증)
4. Staging 환경 준비
5. Phase 1 개발 시작

---

---

## 부록: 개선 사항 요약

### A. RLS 성능 최적화
**문제**: RLS 정책 내 서브쿼리가 각 row마다 실행되어 성능 저하
**해결**: PostgreSQL 세션 변수 활용
- `set_current_organization()` 함수로 트랜잭션당 1회만 설정
- RLS 정책에서 `get_current_organization()` 함수로 조회
- 서브쿼리 제거로 대규모 데이터셋 쿼리 속도 향상

### B. API 보안 강화
**문제**: 미들웨어가 주입한 헤더에 의존하는 암묵적 의존성
**해결**: 세션 기반 직접 조회
- 모든 API 요청에서 인증된 사용자의 profiles 테이블 직접 조회
- 헤더 의존성 제거로 보안 강화
- `approval_status` 검증 추가

### C. 누락 사항 보완
1. **audit_logs RLS 정책 추가**: 기관 관리자만 자신의 기관 로그 조회
2. **마이그레이션 검증 쿼리**: NOT NULL 설정 전 자동 검증 스크립트 추가
3. **마이그레이션 체크리스트**: 안전성 확보를 위한 단계별 검증

---

## 바이브 코딩 가이드

> **개인 프로젝트 특성**: 시간 날 때마다 조금씩 진행. 각 단계가 독립적으로 작동해야 함.

### 작업 순서 추천 (혼자 할 때)

#### 1주차 목표: DB만 건드리기
```bash
✅ 완료 조건: 기존 앱이 정상 작동하는 상태
□ Organizations 테이블 생성
□ organization_id 컬럼 추가 (모든 테이블, nullable)
□ 데이터 마이그레이션 (Default Hospital 생성)
□ 인덱스 생성
```
**중요**: 이 시점에서도 앱은 정상 작동! (organization_id 무시)

#### 2주차 목표: Backend 로직
```bash
✅ 완료 조건: RLS가 있어도 기존 코드 작동
□ 세션 변수 함수 생성
□ RLS 정책 추가 (하지만 fallback 포함)
□ Service Layer에 organizationId 추가 (optional)
```
**중요**: 여전히 앱은 정상 작동! (RLS fallback 덕분)

#### 3주차 목표: Frontend 연결
```bash
✅ 완료 조건: Multi-tenancy 시작 적용
□ OrganizationProvider 생성
□ Query Keys 변경 (점진적)
□ Real-time subscription 수정
```
**중요**: 이제 multi-tenancy 적용 시작

#### 4주차 목표: UI 개선
```bash
✅ 완료 조건: Super Admin/Org Admin UI 완성
□ Super Admin 페이지
□ Org Admin 페이지 개선
□ 회원가입 플로우
□ 네비게이션 바 업데이트
```

#### 5주차 목표: 테스트 & 마무리
```bash
✅ 완료 조건: 프로덕션 배포 가능
□ 데이터 격리 검증
□ 권한 테스트
□ 성능 테스트
□ 배포
```

### 디버깅 팁

```sql
-- 1. 현재 세션의 organization_id 확인
SELECT current_setting('app.current_organization_id', true);

-- 2. RLS 정책이 어떻게 적용되는지 확인
EXPLAIN (ANALYZE, VERBOSE)
SELECT * FROM patients WHERE is_active = true;

-- 3. 특정 사용자의 organization_id 확인
SELECT id, email, organization_id, role
FROM profiles
WHERE email = 'your-email@example.com';

-- 4. 데이터 격리 검증 (다른 기관 데이터 접근 불가)
-- Org A 사용자로 로그인 후
SELECT COUNT(*) FROM patients; -- Org A 환자 수만 나와야 함

-- 5. NULL organization_id 찾기 (마이그레이션 후 0이어야 함)
SELECT 'profiles' AS table_name, COUNT(*) AS null_count
FROM profiles WHERE organization_id IS NULL
UNION ALL
SELECT 'patients', COUNT(*) FROM patients WHERE organization_id IS NULL
UNION ALL
SELECT 'schedules', COUNT(*) FROM schedules WHERE organization_id IS NULL;
```

### 코드 작성 패턴

#### 1. Service Layer (점진적 마이그레이션)
```typescript
// src/services/patientService.ts

// Step 1: optional organizationId
async getAll(
  supabase?: SupabaseClient,
  userContext?: {
    organizationId?: string  // optional로 시작
    role?: string
    userId?: string
  }
): Promise<Patient[]> {
  let query = client.from('patients').select('*')

  // organizationId가 있으면 필터링
  if (userContext?.organizationId) {
    query = query.eq('organization_id', userContext.organizationId)
  }

  return query
}

// Step 2: 나중에 required로 변경
// organizationId: string (required)
```

#### 2. React Query Keys (중앙화)
```typescript
// src/lib/query-keys.ts

export const queryKeys = {
  // 기존 (점진적으로 변경)
  patientsLegacy: () => ['patients'] as const,

  // 신규 (organizationId 포함)
  patients: (organizationId: string) => ['patients', organizationId] as const,
  patient: (organizationId: string, patientId: string) =>
    ['patients', organizationId, patientId] as const,

  // 점진적 마이그레이션을 위한 헬퍼
  getPatientsKey: (organizationId?: string) =>
    organizationId ? queryKeys.patients(organizationId) : queryKeys.patientsLegacy(),
}
```

#### 3. Component (OrganizationProvider 사용)
```typescript
// src/components/patients/patient-list.tsx
'use client'

import { useOrganization } from '@/providers/organization-provider'

export function PatientList() {
  const { organizationId, userRole } = useOrganization()

  const { data: patients } = useQuery({
    queryKey: queryKeys.patients(organizationId),
    queryFn: () => patientService.getAll(undefined, {
      organizationId,
      role: userRole,
    }),
  })

  return <div>...</div>
}
```

### 롤백 가이드

```sql
-- 긴급 롤백: RLS 비활성화 (임시)
BEGIN;

ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 문제 해결 후 다시 활성화
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

COMMIT;
```

```sql
-- 롤백: NOT NULL 제약 제거
ALTER TABLE profiles ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE patients ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE schedules ALTER COLUMN organization_id DROP NOT NULL;
```

### 진행 상황 추적

```markdown
## Multi-Tenancy 진행 상황

### Phase 1: Database (완료: 0/5)
- [ ] 1.1 Organizations 테이블
- [ ] 1.2 organization_id 컬럼 추가
- [ ] 1.3 데이터 마이그레이션
- [ ] 1.4 UserRole 확장
- [ ] 1.5 인덱스 생성

### Phase 2: RLS (완료: 0/8)
- [ ] 2.1 세션 변수 함수
- [ ] 2.2 profiles RLS
- [ ] 2.3 patients RLS
- [ ] 2.4 schedules RLS
- [ ] 2.5 organizations RLS
- [ ] 2.6 items RLS
- [ ] 2.7 audit_logs RLS
- [ ] 2.8 기타 테이블 RLS

### Phase 3: Auth (완료: 0/2)
- [ ] 3.1 Super Admin 설정
- [ ] 3.2 Permission 시스템

### Phase 4: Service Layer (완료: 0/4)
- [ ] 4.1 Context 패턴
- [ ] 4.2 patientService
- [ ] 4.3 scheduleService
- [ ] 4.4 itemService

### Phase 5: API Routes (완료: 0/3)
- [ ] 5.1 Context 주입
- [ ] 5.2 기존 API 업데이트
- [ ] 5.3 Super Admin API

### Phase 6: Frontend (완료: 0/3)
- [ ] 6.1 OrganizationProvider
- [ ] 6.2 Query Keys
- [ ] 6.3 Real-time

### Phase 7: UI/UX (완료: 0/5)
- [ ] 7.1 네비게이션
- [ ] 7.2 Super Admin 페이지
- [ ] 7.3 Org Admin 페이지
- [ ] 7.4 회원가입
- [ ] 7.5 대시보드

### Phase 8: Testing (완료: 0/4)
- [ ] 8.1 데이터 격리
- [ ] 8.2 권한 테스트
- [ ] 8.3 성능 테스트
- [ ] 8.4 마이그레이션 테스트

### Phase 9: 배포 (완료: 0/3)
- [ ] 9.1 환경변수
- [ ] 9.2 백업
- [ ] 9.3 배포 실행
```

### 도움되는 명령어

```bash
# Supabase 마이그레이션 생성
supabase migration new create_organizations

# 마이그레이션 상태 확인
supabase migration list

# 타입 재생성 (DB 변경 후)
npm run generate-types

# Super Admin 승격
npm run promote-super-admin -- your-email@example.com

# 개발 서버 (포트 체크 후)
lsof -i :3000
npm run dev
```

### 마무리 체크리스트

```bash
✅ 배포 전 최종 확인
□ 데이터 백업 완료
□ 환경변수 설정 완료
□ Super Admin 계정 생성
□ 데이터 격리 테스트 통과
□ 권한 매트릭스 검증
□ 성능 테스트 (<1초 응답)
□ RLS 정책 활성화 확인
□ 롤백 스크립트 준비
□ 모니터링 대시보드 확인
□ 사용자 가이드 작성 (선택)
```

---

**작성자**: Claude (Multi-Agent Review)
**최종 업데이트**: 2025-09-28 (의사결정 사항 반영 + 바이브 코딩 가이드 추가)
**리뷰 참여**: Database Architect, Backend Architect, Fullstack Developer, Context Manager