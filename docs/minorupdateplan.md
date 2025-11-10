### **[AI 코딩 에이전트 최종 지침 - 수정본 v2]**

**[Core Directive]**
아래 명시된 최종 계획에 따라 고객 요구사항을 구현합니다. 특히, **'소속' 관리 기능 구현 시 데이터베이스 스키마를 변경하는 과정에서 서비스 중단이 발생하지 않도록, 아래의 '안전한 마이그레이션 전환 전략'을 반드시 준수**해야 합니다.

**[Guiding Principles]**
1.  **점진적 마이그레이션(Incremental Migration):** 기존 스키마를 즉시 파괴하지 않습니다. `ADD -> BACKFILL -> TRANSITION -> DROP`의 4단계 절차를 따릅니다.
2.  **데이터 무결성(Data Integrity):** 구조화된 데이터는 반드시 정규화된 스키마 또는 JSONB 타입을 사용합니다.
3.  **원자성(Atomicity):** 여러 단계로 구성된 작업은 가능한 단일 트랜잭션 또는 API 호출로 묶어 데이터 정합성을 보장합니다.
4.  **성능(Performance):** 대용량 데이터 처리가 예상되는 기능은 반드시 인덱싱, 배치 처리 등 성능 최적화 방안을 함께 구현합니다.
5.  **보안(Security):** 모든 API 엔드포인트는 서버 사이드에서 사용자의 역할과 권한을 검증해야 합니다.

---

### **Phase 1: UI/UX 개선**

1.  **회원가입 내 기관 선택 기능:**
    *   **Action:** `signup-form.tsx`에서 사용자 기본 정보(이름, 이메일 등) 입력 후, '조직 선택' 모달(`OrganizationSearchDialog`, `CreateOrganizationDialog`)을 호출하는 2단계 UI를 구현합니다.
    *   **API 연동:**
        *   기존 조직 선택 시: `/api/join-requests` API를 호출하여 가입 승인 요청을 생성합니다.
        *   신규 조직 생성 시: `/api/organizations/create` API를 호출하여 조직을 생성하고, 사용자를 첫 번째 관리자로 등록합니다.
    *   **Constraint:** 조직 선택/생성 단계에서 사용자가 이탈할 경우를 대비하여, 다음 로그인 시 조직 선택을 다시 유도하는 UI 로직을 추가하십시오.

2.  **대시보드 프로필 정보 확장:**
    *   **Action:** `useProfile` 훅을 수정하여 `organizations` 테이블을 JOIN, 기관명을 함께 조회하도록 쿼리를 개선합니다.
    *   **Action:** `sidebar.tsx`에서 조회된 기관명과 직급(`role`, `care_type`) 정보를 프로필 카드에 표시하도록 UI를 업데이트합니다.

3.  **'소속' 필터 드롭다운 변경:**
    *   **Action:** `CareTypeFilter.tsx`의 버튼 그룹을 shadcn/ui의 `DropdownMenu` 컴포넌트를 사용한 `DepartmentFilterDropdown.tsx`(가칭)로 교체합니다.
    *   **Action:** `useDepartments` 훅을 신규 구현하여 현재 `organization_id`에 속한 소속 목록을 API로 조회하고, 이 데이터를 드롭다운 메뉴 아이템으로 동적으로 렌더링합니다.
    *   **Action:** `filter-context.ts`의 `careTypes` 상태를 `departmentIds: string[]` 형태로 변경하여 다중 선택을 지원하고, 관련 로직을 모두 수정합니다.

4.  **환자 카드 정보 추가:**
    *   **Action:** RPC 함수(`get_calendar_schedules_filtered` 등)가 반환하는 데이터에 이미 주치의 이름(`doctor_name`)과 소속(`care_type`)이 포함되어 있음을 확인했습니다. 이를 활용하여 `dashboard-content.tsx`와 `calendar-day-card.tsx` 내 환자 카드 UI에 해당 정보를 표시합니다.
    *   **Constraint:** 정보가 `null`일 경우 '미지정'으로 표시하는 UI 처리를 반드시 포함하십시오.

---

### **Phase 2: 백엔드 및 데이터베이스 강화 (수정됨)**

#### **1. '소속' 관리 기능 (CRUD) - [CRITICAL] 안전한 마이그레이션 전환 전략**

**[Objective]**
`profiles`, `patients` 테이블의 `care_type: TEXT` 컬럼을 `department_id: UUID` (FK)로 **서비스 중단 및 데이터 유실 없이** 안전하게 전환합니다.

**[Action Sequence]**
**1단계: 스키마 확장 (비파괴적)**
*   **Action:** `departments` 테이블을 신규 생성합니다.
    ```sql
    CREATE TABLE departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
    );
    ```
*   **Action:** `patients`와 `profiles` 테이블에 `department_id` 컬럼을 **NULL을 허용하는 상태로 추가**합니다. `ON DELETE SET NULL` 제약 조건을 포함합니다.
    ```sql
    ALTER TABLE patients ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    ALTER TABLE profiles ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    ```

**2단계: 데이터 동기화 (백필)**
*   **Action:** 마이그레이션 스크립트를 작성하여 기존 `care_type` 값을 `departments` 테이블에 `INSERT`하고, 생성된 `id`를 `patients` 및 `profiles` 테이블의 `department_id`에 업데이트합니다.
    ```sql
    -- 예시 로직 (실제 스크립트는 더 정교해야 함)
    INSERT INTO departments (name, organization_id)
    SELECT DISTINCT care_type, organization_id FROM profiles WHERE care_type IS NOT NULL;

    UPDATE profiles p SET department_id = (
        SELECT d.id FROM departments d
        WHERE d.name = p.care_type AND d.organization_id = p.organization_id
    );
    -- patients 테이블에 대해서도 동일한 로직 수행
    ```

**3단계: 애플리케이션 코드 전환**
*   **Action:** 코드베이스 전체에서 `care_type` 컬럼을 직접 읽고 쓰는 모든 부분을 수정합니다.
    *   **데이터 읽기:** `care_type`이 필요한 경우, `department_id`를 통해 `departments` 테이블을 **JOIN하여 `name`을 가져오도록** 쿼리를 수정합니다. `useProfile` 훅이 이 로직을 포함하도록 수정되어야 합니다.
    *   **데이터 쓰기:** '소속'을 저장하거나 업데이트할 때, `care_type` 문자열 대신 `department_id`를 사용하도록 로직을 변경합니다.
*   **Constraint:** 이 단계가 완료되고 배포되기 전까지는 `care_type` 컬럼을 절대 삭제해서는 안 됩니다.

**4단계: 스키마 정리 (최종)**
*   **Action:** 위 3단계가 완전히 적용되고 안정화된 것을 확인한 후, **별도의 마이그레이션 스크립트**를 통해 기존 `care_type` 컬럼을 `DROP`합니다.
    ```sql
    ALTER TABLE patients DROP COLUMN care_type;
    ALTER TABLE profiles DROP COLUMN care_type;
    ```

**5단계: CRUD API 및 UI 구현**
*   **Action:** `admin` 역할 전용 '소속' CRUD API (`/api/admin/departments/*`)와 관리 페이지 UI를 구현합니다. 모든 API는 `organization_id` 기반으로 격리되어야 합니다.

2.  **기관별 정책 설정 및 자동 보류 기능:**
    *   **Action:** `organization_policies` 테이블을 신규 생성합니다. 스키마는 다음과 같습니다.
        ```sql
        CREATE TABLE organization_policies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
            auto_hold_overdue_days INTEGER
        );
        ```
    *   **Action:** `/admin` 페이지에 `auto_hold_overdue_days` 값을 설정하는 UI와 API를 구현합니다.
    *   **Action:** 매일 자정에 실행될 Supabase Edge Function을 개발합니다.
        *   **Constraint:** `schedules` 테이블 조회 시 성능 부하를 방지하기 위해 `(status, next_due_date)` 컬럼에 **복합 인덱스(Composite Index)**를 반드시 생성하십시오.
        *   **Constraint:** 함수 로직은 모든 연체 스케줄을 한 번에 업데이트하지 말고, `LIMIT 100`과 같이 **배치(Batch) 처리**하여 DB 부하를 분산시켜야 합니다.
        *   **Constraint:** 상태 변경 시, `audit_logs`에 "시스템에 의해 자동 보류됨"과 같은 기록을 남겨 추적 가능하도록 구현합니다.

---

### **Phase 3: 기능 로직 및 표시 방식 개선**

1.  **캘린더 환자 목록 정렬 순서 변경:**
    *   **Action:** `sortSchedulesByPriority` 유틸리티 함수의 정렬 기준 1순위로 '완료 여부'(`display_type === 'completed'`)를 추가합니다. 미완료 항목이 항상 먼저 오도록 정렬합니다.
    *   **Requirement:** 수정된 정렬 로직에 대한 **단위 테스트(Unit Test)를 작성**하여 정확성을 검증해야 합니다.

2. 주사 카테고리 '용량' 입력 기능 - [CRITICAL] 스키마 확장 방식 적용**
*   **[CRITICAL] DO NOT:** `notes` 필드에 "용량: {value}mg" 형식의 문자열로 저장하는 방식을 **절대 사용하지 마십시오.**
*   **[CRITICAL] INSTEAD, DO:**
    1.  **DB 스키마 변경:** `schedule_executions` 테이블에 `metadata`라는 **JSONB 타입 컬럼을 추가**합니다.
        ```sql
        ALTER TABLE schedule_executions ADD COLUMN metadata JSONB;
        ```
    2.  **데이터 저장:** `schedule-completion-dialog`에서 `item_category`가 'injection'일 때, '용량' 입력 필드를 조건부 렌더링하고, 입력된 값을 `metadata` 컬럼에 `{ "dosage": 100, "unit": "mg" }`와 같은 JSON 객체 형태로 저장합니다.
    3.  **UI 렌더링:** `calendar-day-card` 등에서 `metadata` 객체를 파싱하여 '용량: 100mg' 형식으로 표시합니다.

---

### **Timeline & Final Instructions**

*   **Timeline:** 제안된 4주 계획을 승인합니다. 단, Phase 2의 DB 마이그레이션과 Phase 3의 스키마 변경으로 인해 **3주차 백엔드 작업에 더 많은 시간을 할애**하고, 4주차에 기능 로직 개선 및 통합 테스트를 집중적으로 진행하십시오.
*   **Final Check:** 모든 구현이 완료된 후, 본 지침의 **[Core Directive]**와 **[Guiding Principles]**를 기준으로 최종 검토를 수행하고 보고서를 제출하십시오.

