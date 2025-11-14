# Superadmin New Organization Registration System - Implementation Plan

**Created**: 2025-11-13
**Author**: Claude Code
**Status**: Planning Phase
**Priority**: High

---

## 1. 개요 (Overview)

### 문제 정의
현재 신규 회원 가입 플로우에 치명적인 결함이 존재:
1. 사용자가 기본 정보 입력 후 조직 선택 단계에 도달하기 전에 `organization_id = NULL` 상태로 `/approval-pending`으로 리디렉션됨
2. 소속 기관이 없는 상태로 승인 대기 상태가 되어 어떤 조직 관리자도 해당 사용자를 볼 수 없고 승인할 수 없음
3. 결과적으로 사용자는 영구적으로 pending 상태에 갇힘

### 해결 방안
- **신규 회원 가입은 오직 "새로운 기관의 관리자 가입"만 허용**
- 기존 기관 소속 사용자(관리자/의사/스텝)는 **초대 시스템을 통해서만 가입**
- **Superadmin 승인 시스템** 구현: carescheduler7@gmail.com 계정이 신규 기관 생성 요청 승인
- 승인 대기 페이지 한글화 및 안내문 개선

### 모듈 목록

| 모듈 ID | 모듈명 | 위치 | 타입 | 설명 |
|---------|--------|------|------|------|
| **M1** | NewOrgRegistrationForm | `src/components/auth/new-org-registration-form.tsx` | Presentation | 신규 기관 관리자 가입 폼 (기존 signup-form 대체) |
| **M2** | ApprovalPendingPage | `src/app/approval-pending/page.tsx` | Page | 승인 대기 페이지 (한글 안내문) |
| **M3** | SuperAdminDashboard | `src/app/(protected)/super-admin/page.tsx` | Page | 슈퍼어드민 대시보드 (기존 강화) |
| **M4** | PendingOrganizationList | `src/components/super-admin/pending-organization-list.tsx` | Presentation | 신규 기관 승인 대기 목록 |
| **M5** | OrganizationApprovalDialog | `src/components/super-admin/organization-approval-dialog.tsx` | Presentation | 기관 승인/거부 다이얼로그 |
| **M6** | OrganizationRequestsAPI | `src/app/api/super-admin/organization-requests/route.ts` | API Route | 신규 기관 요청 조회 API |
| **M7** | ApproveOrganizationAPI | `src/app/api/super-admin/organization-requests/[id]/approve/route.ts` | API Route | 기관 승인 API |
| **M8** | RejectOrganizationAPI | `src/app/api/super-admin/organization-requests/[id]/reject/route.ts` | API Route | 기관 거부 API |
| **M9** | OrganizationRegistrationService | `src/services/organization-registration.ts` | Business Logic | 기관 등록 요청 처리 로직 |
| **M10** | OrganizationApprovalRPC | `supabase/migrations/[timestamp]_superadmin_org_approval.sql` | Database | 기관 승인 RPC 함수 |
| **M11** | useOrganizationRequests | `src/hooks/useOrganizationRequests.ts` | Hook | React Query 훅 (요청 목록) |
| **M12** | useApproveOrganization | `src/hooks/useApproveOrganization.ts` | Hook | React Query 훅 (승인 mutation) |
| **S1** | ApprovalStatusBadge | `src/components/shared/approval-status-badge.tsx` | Shared Component | 승인 상태 뱃지 (재사용 가능) |
| **S2** | ApprovalGuard | `src/lib/auth/approval-guard.ts` | Shared Utility | 승인 상태 검증 유틸리티 |

---

## 2. Architecture Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        A1[NewOrgRegistrationForm<br/>M1]
        A2[ApprovalPendingPage<br/>M2]
        A3[SuperAdminDashboard<br/>M3]
        A4[PendingOrganizationList<br/>M4]
        A5[OrganizationApprovalDialog<br/>M5]
        S1[ApprovalStatusBadge<br/>Shared Component]
    end

    subgraph "Application Layer - Hooks"
        H1[useOrganizationRequests<br/>M11]
        H2[useApproveOrganization<br/>M12]
    end

    subgraph "API Layer"
        API1[OrganizationRequestsAPI<br/>M6<br/>GET /api/super-admin/organization-requests]
        API2[ApproveOrganizationAPI<br/>M7<br/>POST .../[id]/approve]
        API3[RejectOrganizationAPI<br/>M8<br/>POST .../[id]/reject]
    end

    subgraph "Business Logic Layer"
        BL1[OrganizationRegistrationService<br/>M9]
        S2[ApprovalGuard<br/>Shared Utility]
    end

    subgraph "Database Layer"
        DB1[(organization_requests<br/>New Table)]
        DB2[(organizations)]
        DB3[(profiles)]
        RPC1[approve_org_request<br/>M10]
        RPC2[reject_org_request<br/>M10]
    end

    %% Presentation to Hooks
    A1 -->|Submit Request| BL1
    A3 --> H1
    A4 --> H1
    A5 --> H2

    %% Hooks to API
    H1 -->|fetch| API1
    H2 -->|mutate| API2
    H2 -->|mutate| API3

    %% API to Business Logic
    API1 --> BL1
    API2 --> BL1
    API3 --> BL1

    %% Business Logic to Database
    BL1 -->|validate & query| S2
    BL1 --> DB1
    API2 --> RPC1
    API3 --> RPC2

    %% RPC to Tables
    RPC1 -->|UPDATE| DB2
    RPC1 -->|UPDATE| DB3
    RPC1 -->|UPDATE| DB1
    RPC2 -->|UPDATE| DB1

    %% Shared Components
    A4 -.->|uses| S1
    A5 -.->|uses| S1

    %% Flow Indicators
    A1 -.->|redirect on submit| A2
    A2 -.->|auto redirect<br/>on approval| A3

    style S1 fill:#e1f5ff
    style S2 fill:#e1f5ff
    style DB1 fill:#fff3cd
    style RPC1 fill:#d4edda
    style RPC2 fill:#d4edda
```

### Data Flow

**1. 신규 기관 등록 플로우:**
```
User → NewOrgRegistrationForm (M1)
  → OrganizationRegistrationService (M9)
  → Insert organization_requests (status: pending)
  → Redirect to ApprovalPendingPage (M2)
```

**2. Superadmin 승인 플로우:**
```
SuperAdmin → SuperAdminDashboard (M3)
  → PendingOrganizationList (M4)
  → useOrganizationRequests (M11)
  → GET /api/super-admin/organization-requests (M6)
  → Query organization_requests

SuperAdmin clicks Approve → OrganizationApprovalDialog (M5)
  → useApproveOrganization (M12)
  → POST /api/.../[id]/approve (M7)
  → approve_org_request RPC (M10)
  → Create organization in organizations table
  → Create admin profile in profiles table
  → Update organization_requests (status: approved)
  → Send notification email
```

**3. 실시간 승인 감지 플로우:**
```
ApprovalPendingPage (M2)
  → Supabase Realtime subscription on organization_requests
  → Detect status change to 'approved'
  → Auto redirect to /dashboard
```

---

## 3. Implementation Plan

### Phase 1: Database Schema (M10)

**File**: `supabase/migrations/20251113000000_superadmin_org_approval.sql`

#### 3.1.1 Create organization_requests Table

```sql
-- 신규 기관 등록 요청 테이블
CREATE TABLE IF NOT EXISTS organization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization Info
  organization_name text NOT NULL,
  organization_description text,

  -- Requester Info (Admin-to-be)
  requester_email text NOT NULL UNIQUE,
  requester_name text NOT NULL,
  requester_password_hash text NOT NULL, -- Hashed password

  -- Status Management
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Review Info
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,

  -- Created Organization (after approval)
  created_organization_id uuid REFERENCES organizations(id),
  created_user_id uuid REFERENCES auth.users(id),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_org_requests_status ON organization_requests(status);
CREATE INDEX idx_org_requests_created_at ON organization_requests(created_at DESC);
CREATE INDEX idx_org_requests_email ON organization_requests(requester_email);

-- RLS Policies
ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Public insert (anyone can request)
CREATE POLICY "org_requests_insert_public"
ON organization_requests FOR INSERT
TO public
WITH CHECK (true);

-- Policy: Requester can view own request
CREATE POLICY "org_requests_select_own"
ON organization_requests FOR SELECT
USING (requester_email = auth.jwt()->>'email');

-- Policy: Super Admin can view all
CREATE POLICY "org_requests_select_super_admin"
ON organization_requests FOR SELECT
USING (is_super_admin());

-- Policy: Super Admin can update (approve/reject)
CREATE POLICY "org_requests_update_super_admin"
ON organization_requests FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Updated timestamp trigger
CREATE TRIGGER update_org_requests_updated_at
  BEFORE UPDATE ON organization_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 3.1.2 Create approve_org_request RPC

```sql
CREATE OR REPLACE FUNCTION approve_org_request(
  p_request_id uuid,
  p_super_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request organization_requests%ROWTYPE;
  v_new_org_id uuid;
  v_new_user_id uuid;
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
  IF EXISTS (SELECT 1 FROM organizations WHERE name = v_request.organization_name) THEN
    RAISE EXCEPTION 'Organization name already exists';
  END IF;

  -- Check duplicate email
  IF EXISTS (SELECT 1 FROM profiles WHERE email = v_request.requester_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, is_active)
  VALUES (v_request.organization_name, true)
  RETURNING id INTO v_new_org_id;

  -- Create auth user (using admin API - requires service_role)
  -- Note: This must be called from API route with service_role client
  -- Store user_id from API response

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

COMMENT ON FUNCTION approve_org_request IS 'Superadmin: 신규 기관 등록 요청 승인';
```

#### 3.1.3 Create reject_org_request RPC

```sql
CREATE OR REPLACE FUNCTION reject_org_request(
  p_request_id uuid,
  p_super_admin_id uuid,
  p_rejection_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
```

#### Unit Tests

**File**: `supabase/migrations/__tests__/superadmin_org_approval.test.sql`

```sql
-- Test 1: Create request successfully
BEGIN;
  INSERT INTO organization_requests (
    organization_name,
    organization_description,
    requester_email,
    requester_name,
    requester_password_hash
  ) VALUES (
    'Test Hospital',
    'Test Description',
    'admin@test.com',
    'Test Admin',
    'hashed_password_here'
  );

  SELECT COUNT(*) = 1 AS test_create_request
  FROM organization_requests
  WHERE requester_email = 'admin@test.com'
    AND status = 'pending';
ROLLBACK;

-- Test 2: Approve request (requires super_admin)
-- (Integration test - requires actual super_admin user)

-- Test 3: Reject request
-- (Integration test - requires actual super_admin user)

-- Test 4: Duplicate email prevention
BEGIN;
  INSERT INTO organization_requests (
    organization_name, requester_email, requester_name, requester_password_hash
  ) VALUES ('Org1', 'dup@test.com', 'User1', 'hash1');

  -- Should fail with unique constraint violation
  INSERT INTO organization_requests (
    organization_name, requester_email, requester_name, requester_password_hash
  ) VALUES ('Org2', 'dup@test.com', 'User2', 'hash2');
ROLLBACK;
```

---

### Phase 2: Business Logic Layer (M9)

**File**: `src/services/organization-registration.ts`

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Validation Schemas
 */
export const NewOrgRegistrationSchema = z.object({
  organizationName: z.string().min(2, '기관명은 최소 2자 이상이어야 합니다').max(100),
  organizationDescription: z.string().max(500).optional(),
  requesterName: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').max(50),
  requesterEmail: z.string().email('유효한 이메일 주소를 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
})

export type NewOrgRegistrationInput = z.infer<typeof NewOrgRegistrationSchema>

/**
 * Submit new organization registration request
 */
export async function submitOrganizationRequest(
  input: NewOrgRegistrationInput
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Validate input
    const validated = NewOrgRegistrationSchema.parse(input)

    // Use public client (no auth required for initial request)
    const supabase = createClient()

    // Check duplicate email
    const { data: existingRequest, error: checkError } = await supabase
      .from('organization_requests')
      .select('id')
      .eq('requester_email', validated.requesterEmail)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      return {
        success: false,
        error: '이미 처리 중인 요청이 있습니다. 승인을 기다려주세요.',
      }
    }

    // Hash password (client-side hashing for security)
    // Note: Password will be used when creating auth user on approval
    const { data: insertData, error: insertError } = await supabase
      .from('organization_requests')
      .insert({
        organization_name: validated.organizationName,
        organization_description: validated.organizationDescription || null,
        requester_email: validated.requesterEmail,
        requester_name: validated.requesterName,
        requester_password_hash: validated.password, // Store temporarily (will be used on approval)
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to submit request:', insertError)
      return {
        success: false,
        error: '요청 제출에 실패했습니다. 잠시 후 다시 시도해주세요.',
      }
    }

    return {
      success: true,
      requestId: insertData.id,
    }
  } catch (error) {
    console.error('Organization request error:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }

    return {
      success: false,
      error: '알 수 없는 오류가 발생했습니다.',
    }
  }
}

/**
 * Get organization request by email
 */
export async function getOrganizationRequestByEmail(
  email: string
): Promise<{
  id: string
  organization_name: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  created_at: string
  reviewed_at?: string | null
} | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('organization_requests')
    .select('id, organization_name, requester_name, requester_email, status, rejection_reason, created_at, reviewed_at')
    .eq('requester_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}
```

#### Unit Tests

**File**: `src/services/__tests__/organization-registration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitOrganizationRequest, NewOrgRegistrationSchema } from '../organization-registration'

describe('OrganizationRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('NewOrgRegistrationSchema', () => {
    it('should validate correct input', () => {
      const validInput = {
        organizationName: 'Test Hospital',
        organizationDescription: 'A test hospital',
        requesterName: 'John Doe',
        requesterEmail: 'john@test.com',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
      }

      const result = NewOrgRegistrationSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should reject short organization name', () => {
      const invalidInput = {
        organizationName: 'A',
        requesterName: 'John Doe',
        requesterEmail: 'john@test.com',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
      }

      const result = NewOrgRegistrationSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('organizationName')
      }
    })

    it('should reject password mismatch', () => {
      const invalidInput = {
        organizationName: 'Test Hospital',
        requesterName: 'John Doe',
        requesterEmail: 'john@test.com',
        password: 'SecurePass123',
        passwordConfirm: 'DifferentPass456',
      }

      const result = NewOrgRegistrationSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('passwordConfirm')
      }
    })

    it('should reject invalid email', () => {
      const invalidInput = {
        organizationName: 'Test Hospital',
        requesterName: 'John Doe',
        requesterEmail: 'invalid-email',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
      }

      const result = NewOrgRegistrationSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('requesterEmail')
      }
    })

    it('should reject short password', () => {
      const invalidInput = {
        organizationName: 'Test Hospital',
        requesterName: 'John Doe',
        requesterEmail: 'john@test.com',
        password: 'short',
        passwordConfirm: 'short',
      }

      const result = NewOrgRegistrationSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password')
      }
    })
  })

  describe('submitOrganizationRequest', () => {
    // Integration tests (require Supabase connection)
    it.skip('should submit request successfully', async () => {
      // TODO: Implement with test database
    })

    it.skip('should reject duplicate email', async () => {
      // TODO: Implement with test database
    })
  })
})
```

---

### Phase 3: API Routes (M6, M7, M8)

#### 3.3.1 Organization Requests API (M6)

**File**: `src/app/api/super-admin/organization-requests/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/super-admin/organization-requests
 * Get all organization registration requests
 * Query params:
 *   - status: string (optional) - filter by status (pending, approved, rejected)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin()

    const supabase = await createServiceClient()
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Build query
    let query = supabase
      .from('organization_requests')
      .select(`
        id,
        organization_name,
        organization_description,
        requester_email,
        requester_name,
        status,
        rejection_reason,
        reviewed_by,
        reviewed_at,
        created_organization_id,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Error fetching organization requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: requests || [],
      total: requests?.length || 0,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
```

#### 3.3.2 Approve Organization API (M7)

**File**: `src/app/api/super-admin/organization-requests/[id]/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/super-admin/organization-requests/[id]/approve
 * Approve organization registration request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify Super Admin access
    const { user } = await requireSuperAdmin()

    const supabase = await createServiceClient()
    const requestId = params.id

    // Get request details
    const { data: orgRequest, error: fetchError } = await supabase
      .from('organization_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !orgRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    if (orgRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 400 }
      )
    }

    // Step 1: Create auth user using Admin API
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email: orgRequest.requester_email,
      password: orgRequest.requester_password_hash,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: orgRequest.requester_name,
      },
    })

    if (userError || !newUser.user) {
      console.error('Failed to create user:', userError)
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Step 2: Call RPC to approve request and create organization
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'approve_org_request',
      {
        p_request_id: requestId,
        p_super_admin_id: user.id,
      }
    )

    if (rpcError) {
      // Rollback: Delete created user
      await supabase.auth.admin.deleteUser(newUser.user.id)

      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 }
      )
    }

    // Step 3: Create profile for new admin
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: orgRequest.requester_email,
        name: orgRequest.requester_name,
        role: 'admin',
        organization_id: rpcResult.organization_id,
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        is_active: true,
      })

    if (profileError) {
      console.error('Failed to create profile:', profileError)
      // Note: Organization already created, user needs manual profile creation
      return NextResponse.json(
        {
          error: 'Organization created but profile creation failed',
          organization_id: rpcResult.organization_id,
          user_id: newUser.user.id,
        },
        { status: 500 }
      )
    }

    // Step 4: Update request with created_user_id
    await supabase
      .from('organization_requests')
      .update({ created_user_id: newUser.user.id })
      .eq('id', requestId)

    // TODO: Send approval notification email

    return NextResponse.json({
      success: true,
      organization_id: rpcResult.organization_id,
      user_id: newUser.user.id,
      request_id: requestId,
    })
  } catch (error) {
    console.error('Approval error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
```

#### 3.3.3 Reject Organization API (M8)

**File**: `src/app/api/super-admin/organization-requests/[id]/reject/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RejectRequestSchema = z.object({
  rejectionReason: z.string().max(500).optional(),
})

/**
 * POST /api/super-admin/organization-requests/[id]/reject
 * Reject organization registration request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify Super Admin access
    const { user } = await requireSuperAdmin()

    const supabase = await createServiceClient()
    const requestId = params.id

    // Parse request body
    const body = await request.json()
    const validation = RejectRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Call RPC to reject request
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'reject_org_request',
      {
        p_request_id: requestId,
        p_super_admin_id: user.id,
        p_rejection_reason: validation.data.rejectionReason || null,
      }
    )

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 }
      )
    }

    // TODO: Send rejection notification email

    return NextResponse.json({
      success: true,
      request_id: requestId,
      status: 'rejected',
    })
  } catch (error) {
    console.error('Rejection error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
```

---

### Phase 4: React Query Hooks (M11, M12)

#### 4.1 useOrganizationRequests Hook (M11)

**File**: `src/hooks/useOrganizationRequests.ts`

```typescript
'use client'

import { useQuery, UseQueryResult } from '@tanstack/react-query'

export interface OrganizationRequest {
  id: string
  organization_name: string
  organization_description: string | null
  requester_email: string
  requester_name: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_organization_id: string | null
  created_at: string
  updated_at: string
}

interface UseOrganizationRequestsOptions {
  status?: 'pending' | 'approved' | 'rejected' | null
}

interface OrganizationRequestsResponse {
  requests: OrganizationRequest[]
  total: number
}

/**
 * Fetch organization registration requests (Super Admin only)
 */
export function useOrganizationRequests(
  options: UseOrganizationRequestsOptions = {}
): UseQueryResult<OrganizationRequestsResponse, Error> {
  const { status } = options

  return useQuery<OrganizationRequestsResponse, Error>({
    queryKey: ['organization-requests', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) {
        params.append('status', status)
      }

      const response = await fetch(
        `/api/super-admin/organization-requests?${params.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch requests')
      }

      return response.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}
```

#### 4.2 useApproveOrganization Hook (M12)

**File**: `src/hooks/useApproveOrganization.ts`

```typescript
'use client'

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'

interface ApproveOrganizationVariables {
  requestId: string
}

interface ApproveOrganizationResponse {
  success: boolean
  organization_id: string
  user_id: string
  request_id: string
}

/**
 * Approve organization registration request mutation
 */
export function useApproveOrganization(): UseMutationResult<
  ApproveOrganizationResponse,
  Error,
  ApproveOrganizationVariables
> {
  const queryClient = useQueryClient()

  return useMutation<ApproveOrganizationResponse, Error, ApproveOrganizationVariables>({
    mutationFn: async ({ requestId }) => {
      const response = await fetch(
        `/api/super-admin/organization-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve request')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate organization requests queries
      queryClient.invalidateQueries({ queryKey: ['organization-requests'] })

      // Invalidate organizations list
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

/**
 * Reject organization registration request mutation
 */
export function useRejectOrganization(): UseMutationResult<
  { success: boolean; request_id: string; status: string },
  Error,
  { requestId: string; rejectionReason?: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ requestId, rejectionReason }) => {
      const response = await fetch(
        `/api/super-admin/organization-requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rejectionReason }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject request')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate organization requests queries
      queryClient.invalidateQueries({ queryKey: ['organization-requests'] })
    },
  })
}
```

---

### Phase 5: Shared Components (S1, S2)

#### 5.1 ApprovalStatusBadge (S1)

**File**: `src/components/shared/approval-status-badge.tsx`

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { Clock, Check, X } from 'lucide-react'

interface ApprovalStatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
}

export function ApprovalStatusBadge({ status, size = 'md' }: ApprovalStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'

  switch (status) {
    case 'pending':
      return (
        <Badge className={`bg-yellow-100 text-yellow-800 ${textSize}`}>
          <Clock className={`${iconSize} mr-1`} />
          승인 대기
        </Badge>
      )
    case 'approved':
      return (
        <Badge className={`bg-green-100 text-green-800 ${textSize}`}>
          <Check className={`${iconSize} mr-1`} />
          승인됨
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className={`bg-red-100 text-red-800 ${textSize}`}>
          <X className={`${iconSize} mr-1`} />
          거부됨
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
```

#### 5.2 ApprovalGuard Utility (S2)

**File**: `src/lib/auth/approval-guard.ts`

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export interface ApprovalCheckResult {
  isApproved: boolean
  status: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
  organizationId?: string | null
}

/**
 * Check user's approval status
 */
export async function checkApprovalStatus(
  userId?: string
): Promise<ApprovalCheckResult> {
  try {
    const supabase = await createClient()

    // Get current user if userId not provided
    let targetUserId = userId
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return {
          isApproved: false,
          status: null,
        }
      }
      targetUserId = user.id
    }

    // Get profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('approval_status, rejection_reason, organization_id')
      .eq('id', targetUserId)
      .single()

    if (error || !profile) {
      return {
        isApproved: false,
        status: null,
      }
    }

    return {
      isApproved: profile.approval_status === 'approved',
      status: profile.approval_status,
      rejectionReason: profile.rejection_reason,
      organizationId: profile.organization_id,
    }
  } catch (error) {
    console.error('Approval check error:', error)
    return {
      isApproved: false,
      status: null,
    }
  }
}

/**
 * Require user to be approved
 * Throws error if not approved
 */
export async function requireApproval(): Promise<void> {
  const result = await checkApprovalStatus()

  if (!result.isApproved) {
    throw new Error('User approval required')
  }
}
```

---

### Phase 6: Presentation Layer Components

#### 6.1 NewOrgRegistrationForm (M1)

**File**: `src/components/auth/new-org-registration-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, User, Mail, Lock, AlertCircle } from 'lucide-react'
import { NewOrgRegistrationSchema, submitOrganizationRequest, type NewOrgRegistrationInput } from '@/services/organization-registration'

export function NewOrgRegistrationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<NewOrgRegistrationInput>({
    resolver: zodResolver(NewOrgRegistrationSchema),
    defaultValues: {
      organizationName: '',
      organizationDescription: '',
      requesterName: '',
      requesterEmail: '',
      password: '',
      passwordConfirm: '',
    },
  })

  const onSubmit = async (data: NewOrgRegistrationInput) => {
    try {
      setIsSubmitting(true)
      setError(null)

      const result = await submitOrganizationRequest(data)

      if (!result.success) {
        setError(result.error || '요청 제출에 실패했습니다.')
        return
      }

      // Redirect to approval pending page with email
      router.push(`/approval-pending?email=${encodeURIComponent(data.requesterEmail)}`)
    } catch (err) {
      console.error('Submit error:', err)
      setError('알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            신규 기관 등록 신청
          </CardTitle>
          <CardDescription className="text-center">
            새로운 의료 기관을 등록하고 관리자로 가입합니다
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Organization Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <Building2 className="w-4 h-4" />
                  <span>기관 정보</span>
                </div>

                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기관명 *</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 서울병원" {...field} />
                      </FormControl>
                      <FormDescription>
                        정식 기관 명칭을 입력하세요
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organizationDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기관 설명 (선택)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="기관에 대한 간단한 설명을 입력하세요"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Requester Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <User className="w-4 h-4" />
                  <span>관리자 정보</span>
                </div>

                <FormField
                  control={form.control}
                  name="requesterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름 *</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requesterEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일 *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@hospital.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        승인 알림을 받을 이메일 주소
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <Lock className="w-4 h-4" />
                  <span>비밀번호 설정</span>
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호 *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="최소 8자 이상" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호 확인 *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="비밀번호 재입력" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notice */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>안내사항:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>신청하신 내용은 프로그램 관리자가 검토합니다</li>
                    <li>승인 완료 시 이메일로 안내해드립니다</li>
                    <li>승인까지 보통 2-3일이 소요됩니다</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? '제출 중...' : '등록 신청'}
              </Button>

              {/* Back to Login */}
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => router.push('/auth/signin')}
                  type="button"
                >
                  로그인 페이지로 돌아가기
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**QA Test Sheet**:

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| TC-1: Form Validation - Empty Fields | 1. Open form<br/>2. Click submit without filling | Show validation errors for required fields | ⏳ Pending |
| TC-2: Form Validation - Invalid Email | 1. Enter invalid email format<br/>2. Submit | Show email validation error | ⏳ Pending |
| TC-3: Form Validation - Password Mismatch | 1. Enter different passwords<br/>2. Submit | Show password mismatch error | ⏳ Pending |
| TC-4: Form Validation - Short Password | 1. Enter password < 8 chars<br/>2. Submit | Show password length error | ⏳ Pending |
| TC-5: Successful Submission | 1. Fill all fields correctly<br/>2. Submit | Redirect to /approval-pending with email param | ⏳ Pending |
| TC-6: Duplicate Email Handling | 1. Submit with existing email<br/>2. Check error message | Show "이미 처리 중인 요청이 있습니다" error | ⏳ Pending |
| TC-7: Network Error Handling | 1. Simulate API failure<br/>2. Submit form | Show error alert with retry option | ⏳ Pending |
| TC-8: Button Disabled During Submit | 1. Submit form<br/>2. Try clicking again | Button should be disabled during API call | ⏳ Pending |

---

#### 6.2 Updated ApprovalPendingPage (M2)

**File**: `src/app/approval-pending/page.tsx`

```typescript
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Mail, AlertCircle } from 'lucide-react'
import { ApprovalStatusBadge } from '@/components/shared/approval-status-badge'
import { getOrganizationRequestByEmail } from '@/services/organization-registration'

interface OrganizationRequest {
  id: string
  organization_name: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  created_at: string
  reviewed_at?: string | null
}

function ApprovalPendingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  const [request, setRequest] = useState<OrganizationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchRequest = async () => {
      if (!email) {
        setError('이메일 정보가 없습니다')
        setLoading(false)
        return
      }

      try {
        const data = await getOrganizationRequestByEmail(email)

        if (!data) {
          setError('등록 신청 정보를 찾을 수 없습니다')
          setLoading(false)
          return
        }

        setRequest(data)

        // If approved, redirect to signin
        if (data.status === 'approved') {
          setTimeout(() => {
            router.push('/auth/signin?approved=true')
          }, 3000)
        }
      } catch (err) {
        console.error('Failed to fetch request:', err)
        setError('정보를 불러오는 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [email, router])

  // Real-time subscription for status updates
  useEffect(() => {
    if (!request?.id) return

    const channel = supabase
      .channel(`org-request-${request.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organization_requests',
        filter: `id=eq.${request.id}`,
      }, (payload) => {
        const updated = payload.new as OrganizationRequest
        setRequest(updated)

        // Auto redirect on approval
        if (updated.status === 'approved') {
          setTimeout(() => {
            router.push('/auth/signin?approved=true')
          }, 3000)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [request?.id, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Clock className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-lg">로딩 중...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-center">오류 발생</CardTitle>
            <CardDescription className="text-center">
              {error || '요청 정보를 찾을 수 없습니다'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push('/auth/signup')}
              className="w-full"
            >
              가입 페이지로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Clock className="h-16 w-16 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold">
            승인 대기 중
          </CardTitle>
          <CardDescription className="text-base mt-2">
            신규 기관 등록 신청이 접수되었습니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Request Information */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-gray-900">신청 정보</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">기관명:</span> {request.organization_name}</p>
              <p><span className="font-medium">이름:</span> {request.requester_name}</p>
              <p><span className="font-medium">이메일:</span> {request.requester_email}</p>
              <p><span className="font-medium">신청일:</span> {new Date(request.created_at).toLocaleDateString('ko-KR')}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">상태:</span>
                <ApprovalStatusBadge status={request.status} size="sm" />
              </p>
            </div>
          </div>

          {/* Status-specific Messages */}
          {request.status === 'pending' && (
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <h4 className="font-semibold mb-2">검토 진행 중</h4>
                <p className="text-sm mb-2">
                  프로그램 관리자가 등록 신청을 검토하고 있습니다.
                  승인이 완료되면 등록하신 이메일로 안내 메일을 보내드립니다.
                </p>
                <p className="text-sm">
                  2~3일 이내에 답변이 오지 않는다면{' '}
                  <a
                    href="mailto:carescheduler7@gmail.com"
                    className="font-semibold underline"
                  >
                    carescheduler7@gmail.com
                  </a>
                  으로 연락 주시기 바랍니다.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {request.status === 'approved' && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <h4 className="font-semibold mb-2">승인 완료!</h4>
                <p className="text-sm">
                  신청이 승인되었습니다. 잠시 후 로그인 페이지로 이동합니다.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {request.status === 'rejected' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <h4 className="font-semibold mb-2">신청 거부됨</h4>
                <p className="text-sm mb-2">
                  죄송합니다. 신청이 거부되었습니다.
                </p>
                {request.rejection_reason && (
                  <p className="text-sm">
                    <span className="font-medium">거부 사유:</span> {request.rejection_reason}
                  </p>
                )}
                <p className="text-sm mt-2">
                  자세한 내용은{' '}
                  <a
                    href="mailto:carescheduler7@gmail.com"
                    className="font-semibold underline"
                  >
                    carescheduler7@gmail.com
                  </a>
                  으로 문의해주세요.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Contact Information */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <h4 className="font-semibold mb-2">문의하기</h4>
              <p>
                신청 상태나 기타 문의 사항이 있으신 경우{' '}
                <a
                  href="mailto:carescheduler7@gmail.com"
                  className="font-semibold text-blue-600 underline"
                >
                  carescheduler7@gmail.com
                </a>
                으로 연락 주시기 바랍니다.
              </p>
            </AlertDescription>
          </Alert>

          {/* Action Button */}
          {request.status === 'approved' && (
            <Button
              onClick={() => router.push('/auth/signin')}
              className="w-full"
            >
              로그인하러 가기
            </Button>
          )}

          {request.status === 'rejected' && (
            <Button
              variant="outline"
              onClick={() => router.push('/auth/signup')}
              className="w-full"
            >
              다시 신청하기
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ApprovalPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Clock className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ApprovalPendingContent />
    </Suspense>
  )
}
```

**QA Test Sheet**:

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| TC-9: Load Pending Request | 1. Navigate with email param<br/>2. Check display | Show request details with "승인 대기 중" status | ⏳ Pending |
| TC-10: Real-time Status Update | 1. Admin approves in another window<br/>2. Watch page | Auto-update to approved status without refresh | ⏳ Pending |
| TC-11: Auto Redirect on Approval | 1. Wait for approval<br/>2. Watch navigation | Auto redirect to /auth/signin after 3 seconds | ⏳ Pending |
| TC-12: Rejected Request Display | 1. View rejected request<br/>2. Check message | Show rejection reason and contact info | ⏳ Pending |
| TC-13: Missing Email Parameter | 1. Navigate without email param | Show error message | ⏳ Pending |
| TC-14: Invalid Email | 1. Navigate with non-existent email | Show "정보를 찾을 수 없습니다" error | ⏳ Pending |
| TC-15: Contact Link Click | 1. Click email link | Open default email client to carescheduler7@gmail.com | ⏳ Pending |

---

#### 6.3 PendingOrganizationList (M4)

**File**: `src/components/super-admin/pending-organization-list.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useOrganizationRequests } from '@/hooks/useOrganizationRequests'
import { ApprovalStatusBadge } from '@/components/shared/approval-status-badge'
import { OrganizationApprovalDialog } from './organization-approval-dialog'
import { format } from 'date-fns'
import { Clock, Building2, User, Mail, Calendar } from 'lucide-react'

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

export function PendingOrganizationList() {
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null)

  const { data, isLoading } = useOrganizationRequests({
    status: filter === 'all' ? null : filter,
  })

  const requests = data?.requests || []

  const handleApproveClick = (requestId: string) => {
    setSelectedRequest(requestId)
    setDialogAction('approve')
  }

  const handleRejectClick = (requestId: string) => {
    setSelectedRequest(requestId)
    setDialogAction('reject')
  }

  const handleDialogClose = () => {
    setSelectedRequest(null)
    setDialogAction(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2">로딩 중...</span>
      </div>
    )
  }

  // Calculate statistics
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 신청</CardDescription>
            <CardTitle className="text-2xl">{requests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인 대기</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인 완료</CardDescription>
            <CardTitle className="text-2xl text-green-600">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>거부</CardDescription>
            <CardTitle className="text-2xl text-red-600">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          전체 ({requests.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'pending'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          대기 중 ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'approved'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          승인됨 ({approvedCount})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'rejected'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          거부됨 ({rejectedCount})
        </button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>신규 기관 등록 신청</CardTitle>
          <CardDescription>
            {requests.length}건의 등록 신청
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>기관명</TableHead>
                <TableHead>신청자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>신청일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    등록 신청이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{request.organization_name}</span>
                      </div>
                      {request.organization_description && (
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                          {request.organization_description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{request.requester_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{request.requester_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {format(new Date(request.created_at), 'yyyy-MM-dd')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ApprovalStatusBadge status={request.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveClick(request.id)}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(request.id)}
                          >
                            거부
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline">처리 완료</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedRequest && dialogAction && (
        <OrganizationApprovalDialog
          requestId={selectedRequest}
          action={dialogAction}
          request={requests.find(r => r.id === selectedRequest)}
          onClose={handleDialogClose}
        />
      )}
    </div>
  )
}
```

---

#### 6.4 OrganizationApprovalDialog (M5)

**File**: `src/components/super-admin/organization-approval-dialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useApproveOrganization, useRejectOrganization } from '@/hooks/useApproveOrganization'
import { AlertCircle, Check, X } from 'lucide-react'
import type { OrganizationRequest } from '@/hooks/useOrganizationRequests'

interface OrganizationApprovalDialogProps {
  requestId: string
  action: 'approve' | 'reject'
  request?: OrganizationRequest
  onClose: () => void
}

export function OrganizationApprovalDialog({
  requestId,
  action,
  request,
  onClose,
}: OrganizationApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const approveMutation = useApproveOrganization()
  const rejectMutation = useRejectOrganization()

  const isProcessing = approveMutation.isPending || rejectMutation.isPending

  const handleApprove = async () => {
    try {
      setError(null)
      await approveMutation.mutateAsync({ requestId })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : '승인 처리 중 오류가 발생했습니다'
      setError(message)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('거부 사유를 입력해주세요')
      return
    }

    try {
      setError(null)
      await rejectMutation.mutateAsync({
        requestId,
        rejectionReason: rejectionReason.trim(),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : '거부 처리 중 오류가 발생했습니다'
      setError(message)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' ? (
              <>
                <Check className="w-5 h-5 text-green-600" />
                <span>기관 승인</span>
              </>
            ) : (
              <>
                <X className="w-5 h-5 text-red-600" />
                <span>기관 거부</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === 'approve'
              ? '이 기관 등록을 승인하시겠습니까?'
              : '이 기관 등록을 거부하시겠습니까?'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {request && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">신청 정보</h4>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">기관명:</span> {request.organization_name}</p>
              <p><span className="font-medium">신청자:</span> {request.requester_name}</p>
              <p><span className="font-medium">이메일:</span> {request.requester_email}</p>
              {request.organization_description && (
                <p>
                  <span className="font-medium">설명:</span> {request.organization_description}
                </p>
              )}
            </div>
          </div>
        )}

        {action === 'approve' && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <p className="text-sm font-semibold mb-1">승인 시 수행 작업:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>신규 기관 생성</li>
                <li>관리자 계정 생성 및 활성화</li>
                <li>승인 알림 이메일 발송</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {action === 'reject' && (
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">거부 사유 *</Label>
            <Textarea
              id="rejection-reason"
              placeholder="거부 사유를 입력하세요"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              입력하신 거부 사유는 신청자에게 이메일로 전달됩니다
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            취소
          </Button>
          {action === 'approve' ? (
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? '처리 중...' : '승인'}
            </Button>
          ) : (
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? '처리 중...' : '거부'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 7: Integration & Testing

#### 7.1 Update Signup Page Route

**File**: `src/app/auth/signup/page.tsx`

Replace existing signup form with new organization registration form:

```typescript
import { NewOrgRegistrationForm } from '@/components/auth/new-org-registration-form'

export default function SignupPage() {
  return <NewOrgRegistrationForm />
}
```

#### 7.2 Update Super Admin Dashboard

**File**: `src/app/(protected)/super-admin/page.tsx`

Add link to organization requests:

```typescript
// Add to existing dashboard
import { PendingOrganizationList } from '@/components/super-admin/pending-organization-list'

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Existing dashboard content */}

      {/* Add Organization Requests Section */}
      <section>
        <h2 className="text-xl font-bold mb-4">신규 기관 등록 신청</h2>
        <PendingOrganizationList />
      </section>
    </div>
  )
}
```

#### 7.3 Integration Test Checklist

| Test Area | Test Cases | Status |
|-----------|------------|--------|
| **Database** | ✅ Table created<br/>✅ Indexes created<br/>✅ RLS policies work<br/>✅ RPC functions execute | ⏳ Pending |
| **API Routes** | ✅ GET requests endpoint<br/>✅ POST approve endpoint<br/>✅ POST reject endpoint<br/>✅ Authentication required | ⏳ Pending |
| **Business Logic** | ✅ Validation works<br/>✅ Duplicate email check<br/>✅ Password hashing<br/>✅ Email format | ⏳ Pending |
| **UI Components** | ✅ Form validation<br/>✅ Error display<br/>✅ Loading states<br/>✅ Real-time updates | ⏳ Pending |
| **End-to-End** | ✅ Complete signup flow<br/>✅ Superadmin approval<br/>✅ Email notifications<br/>✅ Auto redirect | ⏳ Pending |

---

## 4. Deployment Checklist

- [ ] **Phase 1**: Run database migration
- [ ] **Phase 2**: Deploy business logic services
- [ ] **Phase 3**: Deploy API routes
- [ ] **Phase 4**: Deploy React Query hooks
- [ ] **Phase 5**: Deploy shared components
- [ ] **Phase 6**: Deploy UI components
- [ ] **Phase 7**: Integration testing
- [ ] **Phase 8**: Update environment variables
- [ ] **Phase 9**: Configure email notifications
- [ ] **Phase 10**: User acceptance testing
- [ ] **Phase 11**: Documentation update
- [ ] **Phase 12**: Production deployment

---

## 5. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Password stored in plain text temporarily | High | Encrypt password hash before storing, rotate keys regularly |
| Superadmin account compromise | Critical | Enable 2FA, IP whitelist, audit logging |
| Email delivery failure | Medium | Implement retry mechanism, fallback notification system |
| Duplicate organization names | Medium | Add unique constraint, case-insensitive check |
| Race condition in approval | Low | Use database transactions, pessimistic locking |

---

## 6. Future Enhancements

1. **Email Notifications**: Send approval/rejection emails via Supabase Auth or SendGrid
2. **2FA for Superadmin**: Add two-factor authentication for carescheduler7@gmail.com
3. **Organization Verification**: Add document upload for organization verification
4. **Approval Workflow**: Multi-stage approval process (L1/L2 approval)
5. **Audit Trail**: Comprehensive audit logging for all superadmin actions
6. **Analytics Dashboard**: Statistics on approval rates, response times

---

## 7. Documentation Updates Required

- [ ] Update `/docs/API-REFERENCE.md` with new endpoints
- [ ] Update `/docs/db/dbschema.md` with new table schema
- [ ] Create `/docs/superadmin-guide.md` for superadmin operations
- [ ] Update user onboarding documentation
- [ ] Create troubleshooting guide for common approval issues

---

## Appendix: Environment Variables

```env
# Existing variables (no changes)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...

# New variables (optional, for future email integration)
# SENDGRID_API_KEY=...
# NOTIFICATION_EMAIL_FROM=noreply@carescheduler.com
```

---

**End of Implementation Plan**
