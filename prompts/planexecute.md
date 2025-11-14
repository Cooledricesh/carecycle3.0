### **[목표] 신규 기관 등록 및 Superadmin 승인 시스템 구축**
**PROMPT:** 아래 지침에 따라 신규 기관 등록 및 Superadmin 승인 시스템을 구현하라. 모든 코드는 제시된 계획을 정확히 따라야 하며, 특히 보안 및 데이터 정합성 원칙을 엄격히 준수해야 한다.
`/docs/plan.md` 문서를 참고하되 프롬프트는 이를 검토하고 작성한 최종 실행안이므로 이 프롬프트의 지시사항을 우선시하라.

### **[핵심 원칙]**

1.  **[보안] 비밀번호 분리 원칙:** 사용자 비밀번호는 `auth.users` 테이블에서만 관리한다. `organization_requests` 테이블 또는 다른 어떤 테이블에도 비밀번호나 해시를 저장하지 않는다.
2.  **[데이터 정합성] 원자적 트랜잭션 원칙:** 사용자 활성화, 기관 생성, 프로필 업데이트는 단일 로직 흐름으로 처리되어야 한다. `approve_org_request` RPC 함수는 데이터베이스 관련 작업을 원자적으로 처리해야 한다.
3.  **[확장성] 역할 기반 접근 제어 원칙:** Superadmin 권한 확인은 이메일 주소('carescheduler7@gmail.com')가 아닌, `profiles` 테이블의 `role` 컬럼 값이 `super_admin`인지 여부로 판단한다.

---

### **[구현 계획]**

#### **Phase 1: 데이터베이스 스키마 및 RPC 수정 (M10)**

**1. `organization_requests` 테이블 수정:**
`requester_password_hash` 컬럼을 제거하고, `auth.users`와 연결될 `requester_user_id`를 추가한다.

**파일:** `supabase/migrations/[timestamp]_superadmin_org_approval.sql`

```sql
-- 신규 기관 등록 요청 테이블
CREATE TABLE IF NOT EXISTS organization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  organization_description text,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 사용자 ID 참조
  requester_email text NOT NULL,
  requester_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS 정책: Superadmin만 모든 요청을 보거나 수정할 수 있음
ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all_access" ON organization_requests FOR ALL USING (is_super_admin());
CREATE POLICY "requester_select_own" ON organization_requests FOR SELECT USING (requester_user_id = auth.uid());

-- 기존 handle_new_user 트리거는 profiles 테이블에만 집중하도록 유지.
```

**2. `approve_org_request` RPC 함수 수정:**
함수 내에서 기관 생성, 프로필 업데이트, 요청 상태 변경을 원자적으로 처리한다. 사용자 계정 생성 로직은 API 레이어로 이동한다.

```sql
CREATE OR REPLACE FUNCTION approve_org_request(p_request_id uuid, p_super_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request organization_requests%ROWTYPE;
  v_new_org_id uuid;
BEGIN
  -- 1. 요청 정보 가져오기
  SELECT * INTO v_request FROM organization_requests WHERE id = p_request_id AND status = 'pending';
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Request not found or already processed'; END IF;

  -- 2. 기관 생성
  INSERT INTO organizations (name, is_active) VALUES (v_request.organization_name, true) RETURNING id INTO v_new_org_id;

  -- 3. 프로필 업데이트 (기관 할당 및 관리자 역할 부여)
  UPDATE profiles
  SET
    organization_id = v_new_org_id,
    role = 'admin',
    approval_status = 'approved',
    approved_by = p_super_admin_id,
    approved_at = now(),
    is_active = true
  WHERE id = v_request.requester_user_id;

  -- 4. 요청 상태 업데이트
  UPDATE organization_requests
  SET status = 'approved', reviewed_by = p_super_admin_id, reviewed_at = now(), created_organization_id = v_new_org_id
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'organization_id', v_new_org_id);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to approve request: %', SQLERRM;
END;
$$;
```

#### **Phase 2: 백엔드 API 및 서비스 로직 수정**

**1. 신규 기관 가입 신청 로직 수정 (`M9`):**
**파일:** `src/services/organization-registration.ts`
`submitOrganizationRequest` 함수를 아래와 같이 수정한다.

*   **Step 1:** Supabase Auth를 통해 신규 사용자를 생성한다. 단, 이메일 인증 상태(`email_confirm`)는 `false`로, `user_metadata`에는 `approval_status: 'pending_organization'`을 추가한다.
*   **Step 2:** `organization_requests` 테이블에 `requester_user_id`와 함께 기관 정보를 저장한다. **비밀번호는 저장하지 않는다.**

**2. 기관 승인 API 로직 수정 (`M7`):**
**파일:** `src/app/api/super-admin/organization-requests/[id]/approve/route.ts`
`POST` 핸들러 로직을 아래 순서로 재구성한다.

*   **Step 1:** `requireSuperAdmin()`으로 Superadmin 권한을 확인한다.
*   **Step 2:** `organization_requests`에서 요청 정보를 가져온다.
*   **Step 3:** `supabase.auth.admin.updateUserById`를 호출하여 대상 사용자의 `email_confirm`을 `true`로 변경하여 계정을 활성화한다.
*   **Step 4:** `approve_org_request` RPC 함수를 호출하여 기관 생성, 프로필 업데이트, 요청 상태 변경을 **단일 트랜잭션**으로 처리한다.
*   **Step 5:** 만약 RPC 호출이 실패하면, **Step 3에서 활성화한 사용자를 다시 비활성화하는 롤백 로직을 반드시 실행**한다.
*   **[TODO]** 성공 시 사용자에게 승인 완료 이메일을 발송하는 로직을 추가한다.

**3. 기관 거부 API 로직 (`M8`):**
**[TODO]** 거부 처리 시 사용자에게 거부 안내 이메일을 발송하는 로직을 추가한다.

#### **Phase 3: 프론트엔드 컴포넌트 구현**

**1. 신규 기관 등록 폼 수정 (`M1`):**
**파일:** `src/components/auth/new-org-registration-form.tsx`

*   '직군' 선택 메뉴를 제거한다. 가입자는 항상 '관리자'로 처리된다.
*   기관명(`organizationName`) 필드에 `onBlur` 이벤트를 사용하여, 입력이 끝났을 때 해당 기관명이 이미 존재하는지 실시간으로 확인하는 기능을 추가한다. (Debounce 적용)

**2. 승인 대기 페이지 개선 (`M2`):**
**파일:** `src/app/approval-pending/page.tsx`

*   안내 문구를 요구사항에 맞춰 한글로 수정한다.
    *   "프로그램 관리자가 등록 신청을 검토하고 있습니다. 승인이 완료되면 안내 메일을 보내드립니다."
    *   "2~3일 이내에 답변이 오지 않는다면 carescheduler7@gmail.com으로 연락 주시기 바랍니다."
*   Supabase Realtime 구독 외에, 30초마다 `useQuery`의 `refetchInterval`을 사용하여 승인 상태를 주기적으로 확인하는 **폴링(polling) 폴백(fallback) 로직을 구현**한다.

#### **Phase 4: 이메일 알림 구현**

**통합 서비스:** Resend 또는 Supabase의 내장 이메일 기능을 사용한다.
**구현 위치:**
*   `ApproveOrganizationAPI`: 승인 성공 시 환영 및 안내 이메일 발송.
*   `RejectOrganizationAPI`: 거부 처리 시 사유를 포함한 안내 이메일 발송.

---

이 지침에 따라 즉시 구현을 시작하라. 질문이 있다면 추가 컨텍스트를 요청하라.