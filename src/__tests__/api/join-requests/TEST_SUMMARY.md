# Join Request API Test Suite - RED Phase Complete

## Test Status: RED PHASE COMPLETE ✅

All 71 tests have been created and are currently failing as expected in the TDD RED phase.

## Test Files Created

### 1. Core Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `get-join-requests.test.ts` | 15 | List pending join requests (admin only) |
| `approve-join-request.test.ts` | 16 | Approve join requests (admin only) |
| `reject-join-request.test.ts` | 19 | Reject join requests (admin only) |
| `create-join-request.test.ts` | 21 | Create new join requests (authenticated users) |
| **Total** | **71** | **Complete API coverage** |

### 2. Supporting Files

| File | Purpose |
|------|---------|
| `test-fixtures.ts` | Shared mock data, utilities, builders |
| `README.md` | Complete test suite documentation |
| `TEST_SUMMARY.md` | This file - RED phase summary |

## Test Execution Results

```bash
npm test -- src/__tests__/api/join-requests/ --run
```

**Result**: All 71 tests failing ✅

**Why tests fail (expected)**:
1. API endpoints not implemented yet (`/api/admin/join-requests`, `/api/join-requests`)
2. Database tables may not exist (`join_requests` table)
3. This is the RED phase - tests must fail before implementation

## Test Coverage Summary

### Authorization & Security (15 tests)
- ✅ Authentication checks (401 errors)
- ✅ Role-based access control (403 errors)
- ✅ Organization isolation
- ✅ Cross-organization request prevention

### Request Validation (18 tests)
- ✅ Required field validation
- ✅ Role enumeration (admin, doctor, nurse)
- ✅ Organization existence validation
- ✅ Duplicate request prevention
- ✅ Email format validation
- ✅ Request ID validation

### Business Logic (23 tests)
- ✅ Approve workflow with profile update
- ✅ Reject workflow without profile update
- ✅ Reviewer tracking (reviewer_id, reviewed_at)
- ✅ Status transitions (pending → approved/rejected)
- ✅ Reapplication after rejection
- ✅ Transaction handling

### Data Management (10 tests)
- ✅ Sorting (created_at DESC)
- ✅ Filtering (status, organization_id)
- ✅ Response structure validation
- ✅ Field completeness checks
- ✅ Empty state handling

### Error Handling (5 tests)
- ✅ Database operation failures
- ✅ Network errors
- ✅ Malformed requests
- ✅ Transaction rollback

## Next Steps: GREEN Phase

### 1. Database Setup

Create the `join_requests` table:

```sql
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  organization_name TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('admin', 'doctor', 'nurse')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES profiles(id),

  -- Prevent duplicate pending requests
  CONSTRAINT unique_pending_request UNIQUE (user_id, organization_id, status)
);

-- Create indexes for performance
CREATE INDEX idx_join_requests_organization_id ON join_requests(organization_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);
CREATE INDEX idx_join_requests_user_id ON join_requests(user_id);
CREATE INDEX idx_join_requests_created_at ON join_requests(created_at DESC);

-- Enable RLS
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own join requests"
  ON join_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view requests for their organization"
  ON join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.organization_id = join_requests.organization_id
    )
  );

CREATE POLICY "Users can create join requests"
  ON join_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id IS NULL
    )
  );

CREATE POLICY "Admins can update requests for their organization"
  ON join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.organization_id = join_requests.organization_id
    )
  );
```

### 2. API Endpoint Implementation

Implement these endpoints in order:

#### Priority 1: User-facing endpoint
- `POST /api/join-requests` (create-join-request.test.ts)
  - Allows users to request organization membership
  - File: `src/app/api/join-requests/route.ts`

#### Priority 2: Admin management endpoints
- `GET /api/admin/join-requests` (get-join-requests.test.ts)
  - List pending requests for admin's organization
  - File: `src/app/api/admin/join-requests/route.ts`

- `POST /api/admin/join-requests/[id]/approve` (approve-join-request.test.ts)
  - Approve request and update user profile
  - File: `src/app/api/admin/join-requests/[id]/approve/route.ts`

- `POST /api/admin/join-requests/[id]/reject` (reject-join-request.test.ts)
  - Reject request without profile changes
  - File: `src/app/api/admin/join-requests/[id]/reject/route.ts`

### 3. Implementation Checklist

For each endpoint:
- [ ] Create route file in correct location
- [ ] Implement authentication check
- [ ] Implement authorization check (role-based)
- [ ] Validate request body/params
- [ ] Implement business logic
- [ ] Handle database operations
- [ ] Implement error handling
- [ ] Return proper response format
- [ ] Run tests and verify they pass

### 4. Test Organization Strategy

**Order of implementation**:
1. `POST /api/join-requests` (21 tests) - Foundational
2. `GET /api/admin/join-requests` (15 tests) - View layer
3. `POST /api/admin/join-requests/[id]/approve` (16 tests) - Approval flow
4. `POST /api/admin/join-requests/[id]/reject` (19 tests) - Rejection flow

**After each endpoint implementation**:
```bash
# Run specific test file
npm test -- src/__tests__/api/join-requests/[test-file].test.ts

# Verify all passing
npm test -- src/__tests__/api/join-requests/ --run
```

## Key Implementation Notes

### Authorization Matrix

| Endpoint | Allowed Roles | Organization Check |
|----------|---------------|-------------------|
| POST /api/join-requests | All authenticated (no org) | N/A |
| GET /api/admin/join-requests | admin | Same org only |
| POST /api/admin/join-requests/[id]/approve | admin | Same org only |
| POST /api/admin/join-requests/[id]/reject | admin | Same org only |

### Transaction Requirements

**Approval endpoint MUST use transaction**:
1. Update `join_requests` (status, reviewer_id, reviewed_at)
2. Update `profiles` (organization_id, role)
3. Rollback both if either fails

**Rejection endpoint**:
1. Update only `join_requests` (status, reviewer_id, reviewed_at)
2. No profile changes

### Response Format Standards

**Success (200/201)**:
```typescript
{
  data: JoinRequest | JoinRequest[],
  message: string
}
```

**Error (4xx/5xx)**:
```typescript
{
  error: string,
  message: string
}
```

### Test Organizations

**CRITICAL**: Only use these for testing:
- 테스트병원 (Test Hospital)
- 대동병원 (Daedong Hospital)

## Mock Data Reference

All test data defined in `test-fixtures.ts`:
- `MOCK_PROFILES`: 5 user profiles
- `MOCK_JOIN_REQUESTS`: 5 join requests
- `TEST_ORGANIZATIONS`: 2 test hospitals
- Mock builders for Supabase responses

## Running Tests During Development

```bash
# Watch mode (recommended during implementation)
npm run test:watch -- src/__tests__/api/join-requests/

# Run all tests once
npm test -- src/__tests__/api/join-requests/ --run

# Run specific endpoint tests
npm test -- src/__tests__/api/join-requests/create-join-request.test.ts --run

# Coverage report
npm run test:coverage -- src/__tests__/api/join-requests/
```

## Expected Timeline

- **RED Phase**: ✅ Complete (71 tests created, all failing)
- **GREEN Phase**: Pending (implement endpoints, make tests pass)
- **REFACTOR Phase**: Pending (improve code while keeping tests green)

## Success Criteria

GREEN phase complete when:
- [ ] All 71 tests pass
- [ ] All 4 API endpoints implemented
- [ ] Database table created with RLS
- [ ] Authorization working correctly
- [ ] Transaction handling verified
- [ ] Error cases handled gracefully

## Questions?

Refer to:
- `README.md` - Full test suite documentation
- `test-fixtures.ts` - Mock data and utilities
- Individual test files - Specific endpoint requirements
- `/docs/multitenancy-implementation-plan.md` - Overall system design

---

**TDD Mantra**:
- RED: Write failing test ✅
- GREEN: Make it pass (next)
- REFACTOR: Make it better (after)

**Current Status**: RED phase complete, ready for GREEN phase implementation.
