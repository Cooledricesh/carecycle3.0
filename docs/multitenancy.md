### **[지침] 코드베이스 멀티테넌시 도입 최종 실행 계획서**

**목표:** 주어진 코드베이스에 `organization` 테이블을 기반으로 한 멀티테넌시 아키텍처를 도입한다. 모든 데이터는 `organization`에 귀속되며, 사용자는 자신의 조직 데이터에만 접근할 수 있도록 격리하는 것을 목표로 한다.

**핵심 요구사항:**
*   모든 사용자(`profiles`)는 하나의 `organization`에 소속된다.
*   사용자가 생성하는 모든 데이터(`patients`, `schedules` 등)는 해당 사용자의 `organization`에 귀속된다.
*   사용자는 RLS(Row Level Security) 정책에 의해 자신의 `organization` 데이터에만 접근할 수 있다.
*   **신규 사용자 가입 프로세스:**
    1. 신규 사용자는 가입 시 기존 `organization` 목록을 확인한다.
    2. 소속 기관이 목록에 있으면 해당 기관을 선택하여 가입 신청을 한다.
    3. 해당 기관의 `admin` 권한자가 신청을 승인하면 가입이 완료된다.
    4. 소속 기관이 없으면 새로운 `organization`을 생성하며 가입한다 (해당 사용자가 첫 관리자가 됨).
*   **기존 데이터 처리:** 모든 기존 사용자와 데이터는 '대동병원'이라는 단일 `organization`에 소속된다.

---

### **1. 데이터베이스 변경 (Database Changes)**

#### **1.1. 신규 테이블 추가**

1.  **`organizations` 테이블 생성:** 테넌트(기관) 정보를 저장한다.
2.  **`join_requests` 테이블 생성:** 신규 사용자의 조직 가입 신청을 관리한다.
3.  **`invitations` 테이블 생성:** 사용자 초대 기능을 위해 추가한다 (선택적 기능).

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_multitenancy_tables.sql

-- 1. Organization 테이블
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 조직명은 중복 불가 (검색 기능 위해)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.organizations IS '각 사용자 그룹(기관) 정보를 저장합니다.';

-- 2. Join Requests 테이블 (신규 가입 신청 관리)
CREATE TABLE public.join_requests (
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
CREATE INDEX ON public.join_requests (organization_id);
CREATE INDEX ON public.join_requests (email);
CREATE UNIQUE INDEX ON public.join_requests (organization_id, email, status) WHERE (status = 'pending'); -- 동일 조직 대기중 중복 신청 방지
COMMENT ON TABLE public.join_requests IS '신규 사용자의 조직 가입 신청을 관리합니다.';

-- 3. Invitations 테이블 (기존 사용자 초대용, 선택적)
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'nurse', -- 'admin', 'doctor', 'nurse'
    token TEXT UNIQUE NOT NULL DEFAULT extensions.uuid_generate_v4()::text,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
CREATE INDEX ON public.invitations (organization_id);
CREATE UNIQUE INDEX ON public.invitations (organization_id, email, status) WHERE (status = 'pending'); -- 조직 내 대기중인 이메일 중복 초대 방지
COMMENT ON TABLE public.invitations IS '사용자를 조직에 초대하기 위한 테이블입니다.';
```

#### **1.2. 기존 테이블 수정**

테넌트별로 분리되어야 하는 모든 테이블에 `organization_id` 외래 키(Foreign Key)를 추가한다.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_organization_fk.sql

-- 중요: 아래 ALTER TABLE 작업은 기존 데이터 마이그레이션 이후 'NOT NULL' 제약 조건을 추가해야 함
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.items ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_executions ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 성능 향상을 위한 인덱스 추가
CREATE INDEX ON public.profiles (organization_id);
CREATE INDEX ON public.patients (organization_id);
CREATE INDEX ON public.items (organization_id);
CREATE INDEX ON public.schedules (organization_id);
```

#### **1.3. UNIQUE 제약 조건 수정**

기존 UNIQUE 제약 조건을 `organization_id`를 포함한 복합 UNIQUE 제약 조건으로 변경하여 조직별 고유성을 보장한다.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_update_unique_constraints.sql

-- 예시: patients 테이블
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_patient_number_key;
ALTER TABLE public.patients ADD CONSTRAINT unique_patient_number_per_org UNIQUE (organization_id, patient_number);

-- 예시: items 테이블
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_code_key;
ALTER TABLE public.items ADD CONSTRAINT unique_item_code_per_org UNIQUE (organization_id, code);
```

#### **1.4. RLS 정책 및 함수 수정**

1.  **헬퍼 함수 생성:** 현재 사용자의 `organization_id`를 가져오는 함수를 `SECURITY DEFINER` 및 `search_path` 설정과 함께 안전하게 생성한다.

    ```sql
    -- supabase/migrations/YYYYMMDDHHMMSS_update_rls.sql
    CREATE OR REPLACE FUNCTION auth.get_current_user_organization_id()
    RETURNS UUID AS $$
    DECLARE
        org_id UUID;
    BEGIN
        SELECT organization_id INTO org_id
        FROM public.profiles
        WHERE id = auth.uid()
        LIMIT 1;
        RETURN org_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    ```
2.  **RLS 정책 업데이트:** `organization_id`가 추가된 모든 테이블의 RLS 정책을 업데이트하여, 현재 사용자의 조직 ID와 데이터의 조직 ID가 일치하는 경우에만 접근을 허용하도록 수정한다.

    ```sql
    -- 예시: patients 테이블
    ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow select for organization members" ON public.patients;
    CREATE POLICY "Allow select for organization members" ON public.patients FOR SELECT
        USING (organization_id = auth.get_current_user_organization_id());
    -- INSERT, UPDATE, DELETE 정책도 동일한 방식으로 WITH CHECK, USING 절에 조건 추가
    ```

#### **1.5. 기존 데이터 마이그레이션**

기존 데이터를 '대동병원' 단일 `organization`에 귀속시키는 마이그레이션 스크립트를 작성한다.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_migrate_existing_data.sql
-- 중요: 실행 전 반드시 데이터베이스를 백업해야 합니다.

DO $$
DECLARE
    daedong_org_id UUID;
BEGIN
    -- 1. '대동병원' organization 생성 (이미 존재하면 ID만 가져옴)
    INSERT INTO public.organizations (name)
    VALUES ('대동병원')
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO daedong_org_id;

    -- 이미 존재하는 경우 ID 가져오기
    IF daedong_org_id IS NULL THEN
        SELECT id INTO daedong_org_id FROM public.organizations WHERE name = '대동병원';
    END IF;

    -- 2. 모든 기존 사용자를 '대동병원'에 소속
    UPDATE public.profiles
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    -- 3. 모든 기존 데이터를 '대동병원'에 귀속
    UPDATE public.patients
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    UPDATE public.items
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    UPDATE public.schedules
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    UPDATE public.schedule_executions
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    UPDATE public.notifications
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    UPDATE public.audit_logs
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    RAISE NOTICE '모든 기존 데이터가 대동병원(ID: %)에 귀속되었습니다.', daedong_org_id;
END $$;

-- 4. 마이그레이션 완료 후, 모든 테이블의 organization_id를 NOT NULL로 변경
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.patients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.schedule_executions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET NOT NULL;
```

---

### **2. 코드 변경 (Code Changes)**

#### **2.1. 타입 정의 업데이트**

`src/lib/database.types.ts` 및 `src/types/*.ts` 파일의 모든 관련 인터페이스에 `organizationId: string;` 속성을 추가한다.

#### **2.2. 회원가입 및 조직 가입 신청 로직**

회원가입 로직을 수정하여 다음 시나리오를 처리한다:

**가입 UI 플로우:**
1.  **조직 검색 단계:** 신규 사용자가 가입 시 기존 `organizations` 목록을 검색할 수 있는 UI 제공
    *   자동완성 또는 드롭다운으로 조직명 검색
    *   조직을 찾지 못한 경우 "새 조직 생성" 옵션 제공
2.  **가입 신청 단계:**
    *   **기존 조직 선택 시:** `join_requests` 테이블에 가입 신청 레코드 생성 (status: 'pending')
        *   사용자 계정은 생성되지만 `organization_id`는 NULL 상태 (승인 대기)
        *   로그인 후 "가입 승인 대기 중" 상태 페이지 표시
    *   **새 조직 생성 시:** 새로운 `organization` 생성 및 사용자를 첫 번째 관리자로 등록
        *   단일 트랜잭션으로 처리 (Supabase RPC 함수 사용)

**관리자 승인 로직 (`src/app/api/admin/join-requests/route.ts`):**
1.  조직의 `admin` 권한 사용자만 `join_requests` 조회 및 승인/거부 가능
2.  승인 시:
    *   해당 사용자의 `profiles.organization_id` 업데이트
    *   `join_requests.status`를 'approved'로 변경
    *   `reviewed_by`, `reviewed_at` 기록
3.  거부 시:
    *   `join_requests.status`를 'rejected'로 변경
    *   사용자는 다른 조직에 재신청 가능

**Supabase RPC 함수 (새 조직 생성 + 사용자 등록):**
```sql
-- 함수명: create_organization_and_register_user
CREATE OR REPLACE FUNCTION public.create_organization_and_register_user(
    p_organization_name TEXT,
    p_user_id UUID,
    p_user_name TEXT,
    p_user_role TEXT
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- 1. 새 조직 생성
    INSERT INTO public.organizations (name)
    VALUES (p_organization_name)
    RETURNING id INTO new_org_id;

    -- 2. 사용자 프로필 업데이트
    UPDATE public.profiles
    SET organization_id = new_org_id,
        role = p_user_role
    WHERE id = p_user_id;

    RETURN new_org_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '조직 생성 또는 사용자 등록 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **2.3. 데이터 생성/수정/조회(CRUD) 로직**

모든 데이터베이스 CRUD 작업은 현재 사용자의 `organization_id`를 기준으로 필터링되어야 한다. RLS에만 의존하지 말고, **코드 레벨에서도 명시적으로 `.eq('organization_id', userOrgId)` 조건을 추가**하여 이중으로 방어한다.

*   **Create:** 데이터 생성 시 `organization_id` 필드를 반드시 포함하여 INSERT 한다.
*   **Read:** 모든 SELECT 쿼리에 `organization_id` 필터링 조건을 추가한다.
*   **Update/Delete:** `organization_id`를 조건으로 사용하여 다른 조직의 데이터를 수정/삭제하지 않도록 방어한다.

#### **2.4. 사용자 세션/컨텍스트**

로그인 또는 세션 갱신 시 `profiles` 테이블에서 `organization_id`를 조회하여 사용자 컨텍스트(`src/providers/auth-provider-simple.tsx`)에 포함시킨다.
*   **성능 최적화:** Supabase JWT의 `app_metadata`에 `organization_id`를 저장하여 RLS 정책에서 DB 조회 없이 값을 사용하도록 개선하는 것을 고려한다.

#### **2.5. 관리자 페이지 - 가입 신청 관리**

조직의 관리자가 가입 신청을 관리할 수 있는 페이지를 구현한다.

**UI 구성 (`src/app/(protected)/admin/join-requests/page.tsx`):**
*   대기 중인 가입 신청 목록 표시 (이메일, 이름, 희망 역할, 신청일)
*   각 신청에 대해 "승인" / "거부" 버튼 제공
*   승인 시 역할 선택 가능 (신청자가 원하는 역할과 다르게 설정 가능)

**API 엔드포인트:**
1.  `GET /api/admin/join-requests` - 대기 중인 가입 신청 목록 조회 (admin 권한 필요)
2.  `POST /api/admin/join-requests/[id]/approve` - 가입 신청 승인
3.  `POST /api/admin/join-requests/[id]/reject` - 가입 신청 거부

#### **2.6. 사용자 초대 기능 구현 (선택적)**

기존 사용자를 조직에 초대하는 기능 (이메일 기반).

*   **UI:** 조직 관리 페이지에서 이메일로 다른 사용자를 초대할 수 있는 UI를 구현한다.
*   **API:** `/api/invitations`와 같은 엔드포인트를 만들어 초대 생성, 수락, 거절 로직을 처리한다.

---

### **3. 후속 작업 (Post-Implementation Tasks)**

*   **통합 테스트:** 멀티테넌시 시나리오에 대한 종합적인 테스트 케이스를 작성하고 실행한다:
    1. 다른 조직의 데이터 접근 시도 (RLS 정책 검증)
    2. 가입 신청 플로우 (조직 검색 → 신청 → 승인/거부)
    3. 새 조직 생성 플로우
    4. 관리자 권한 검증 (가입 신청 관리)
    5. 기존 데이터 '대동병원' 귀속 확인

---

### **4. 구현 우선순위 (Implementation Priority)**

#### **Phase 1: 기본 멀티테넌시 구조 (필수)**
1. 데이터베이스 스키마 변경 (organizations, join_requests 테이블)
2. 기존 데이터 '대동병원'으로 마이그레이션
3. RLS 정책 업데이트
4. 타입 정의 업데이트

#### **Phase 2: 가입 신청 시스템 (필수)**
1. 가입 UI 수정 (조직 검색 기능)
2. 가입 신청 API 구현
3. 관리자 페이지 - 가입 신청 관리
4. 승인/거부 프로세스 구현

#### **Phase 3: 데이터 격리 (필수)**
1. 모든 CRUD 로직에 organization_id 필터링 추가
2. 사용자 컨텍스트에 organization_id 포함
3. RLS 정책 강화

#### **Phase 4: 사용자 초대 기능 (선택적)**
1. 초대 테이블 활용 (invitations)
2. 초대 이메일 발송 기능
3. 초대 수락/거절 UI

---

### **5. 주요 보안 고려사항 (Security Considerations)**

1. **데이터 격리:**
   - RLS 정책으로 1차 방어
   - 코드 레벨 필터링으로 2차 방어 (`.eq('organization_id', userOrgId)`)
   - 모든 쿼리에 organization_id 조건 필수

2. **권한 관리:**
   - 관리자 권한 검증 (가입 신청 승인/거부)
   - 역할 기반 접근 제어 (admin, doctor, nurse)
   - 권한 검증은 서버 사이드에서만 수행

3. **가입 신청 보안:**
   - 동일 조직 중복 신청 방지 (UNIQUE INDEX)
   - 이메일 유효성 검증
   - 관리자 승인 필수 (자동 승인 금지)

4. **조직 관리:**
   - 조직명 중복 방지 (UNIQUE 제약)
   - 조직 삭제 시 CASCADE 정책 신중히 적용
   - 최소 1명의 관리자 유지 정책 고려