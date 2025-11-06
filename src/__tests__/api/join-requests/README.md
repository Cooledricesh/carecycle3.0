# Join Request API Test Suite

Comprehensive TDD test suite for the multitenancy join request system.

## Test Coverage

### 1. GET /api/admin/join-requests
**File**: `get-join-requests.test.ts`

Lists pending join requests for organization admins.

**Test Scenarios** (15 tests):
- Authorization Tests (3)
  - Returns 401 when user is not authenticated
  - Returns 403 when user is not an admin (doctor, nurse)
  - Returns 403 when admin has no organization_id
- Organization Isolation Tests (3)
  - Returns only pending requests from admin's organization
  - Does NOT return requests from other organizations
  - Verifies organization_id filter is applied in database query
- Status Filtering Tests (2)
  - Returns only pending requests, not approved or rejected
  - Verifies status filter is applied in database query
- Sorting Tests (2)
  - Returns requests sorted by created_at DESC (newest first)
  - Verifies order by created_at desc is applied
- Response Format Tests (3)
  - Returns correct response structure with data array
  - Includes all required fields in each join request
  - Returns empty array when no pending requests exist
- Error Handling Tests (2)
  - Returns 500 when database query fails
  - Returns 403 when admin has no organization_id

---

### 2. POST /api/admin/join-requests/[id]/approve
**File**: `approve-join-request.test.ts`

Allows admins to approve pending join requests.

**Test Scenarios** (16 tests):
- Authorization Tests (3)
  - Returns 401 when user is not authenticated
  - Returns 403 when user is not an admin (doctor, nurse)
- Request Validation Tests (5)
  - Returns 404 when join request does not exist
  - Returns 403 when trying to approve request from different organization
  - Returns 400 when request is already approved
  - Returns 400 when request is already rejected
  - Returns 400 when request ID is missing
- Approval Process Tests (4)
  - Successfully approves pending request and updates all required fields
  - Updates user profile with organization_id and role
  - Updates join_requests table with reviewer_id and reviewed_at
  - Performs all updates in a transaction (both tables)
- Response Format Tests (2)
  - Returns correct response structure on success
  - Includes success message in response
- Error Handling Tests (2)
  - Rolls back on profile update failure
  - Returns 500 when database operation fails

---

### 3. POST /api/admin/join-requests/[id]/reject
**File**: `reject-join-request.test.ts`

Allows admins to reject pending join requests.

**Test Scenarios** (19 tests):
- Authorization Tests (3)
  - Returns 401 when user is not authenticated
  - Returns 403 when user is not an admin (doctor, nurse)
- Request Validation Tests (5)
  - Returns 404 when join request does not exist
  - Returns 403 when trying to reject request from different organization
  - Returns 400 when request is already approved
  - Returns 400 when request is already rejected
  - Returns 400 when request ID is missing
- Rejection Process Tests (5)
  - Successfully rejects pending request and updates status
  - Does NOT update user profile when rejecting
  - Updates join_requests table with reviewer_id and reviewed_at
  - Records reviewer_id of the admin who rejected the request
  - Records reviewed_at timestamp when rejecting
- User Reapplication Tests (2)
  - Allows user to create new request after rejection
  - Does not block user from applying to different organization after rejection
- Response Format Tests (2)
  - Returns correct response structure on success
  - Includes success message in response
- Error Handling Tests (2)
  - Returns 500 when database operation fails
  - Handles network errors gracefully

---

### 4. POST /api/join-requests
**File**: `create-join-request.test.ts`

Allows authenticated users to create join requests.

**Test Scenarios** (21 tests):
- Authorization Tests (3)
  - Returns 401 when user is not authenticated
  - Allows authenticated users with no organization to create request
  - Rejects users who already have an organization
- Request Validation Tests (6)
  - Requires organization_id in request body
  - Requires requested_role in request body
  - Validates requested_role is one of: admin, doctor, nurse
  - Accepts "admin" as valid requested_role
  - Accepts "doctor" as valid requested_role
  - Accepts "nurse" as valid requested_role
- Organization Validation Tests (2)
  - Verifies organization exists before creating request
  - Allows requests to test organizations (테스트병원, 대동병원)
- Duplicate Request Prevention Tests (3)
  - Prevents duplicate pending requests for same organization
  - Allows new request after previous one was rejected
  - Allows requests to different organizations
- Email Validation Tests (2)
  - Uses authenticated user email for the request
  - Rejects request when user email is missing
- Success Response Tests (3)
  - Returns 201 with created join request on success
  - Includes all required fields in created request
  - Includes success message in response
- Error Handling Tests (2)
  - Returns 500 when database insert fails
  - Returns 400 when request body is malformed JSON

---

## Test Fixtures

**File**: `test-fixtures.ts`

Shared test data and utilities:
- Mock profiles (admin, doctor, nurse, pending user, other org admin)
- Mock join requests (pending, approved, rejected, other org)
- Test organizations (테스트병원, 대동병원)
- Supabase mock builders
- Response builders
- Error builders

## Running Tests

```bash
# Run all join request tests
npm test -- src/__tests__/api/join-requests/

# Run specific test file
npm test -- src/__tests__/api/join-requests/get-join-requests.test.ts

# Run with coverage
npm run test:coverage -- src/__tests__/api/join-requests/

# Watch mode
npm run test:watch -- src/__tests__/api/join-requests/
```

## TDD Cycle Status

### RED Phase: Complete ✅
All 71 tests are currently failing as expected:
- 15 tests for GET /api/admin/join-requests
- 16 tests for POST /api/admin/join-requests/[id]/approve
- 19 tests for POST /api/admin/join-requests/[id]/reject
- 21 tests for POST /api/join-requests

### GREEN Phase: Pending
Implementation of the following API endpoints required:
1. GET /api/admin/join-requests
2. POST /api/admin/join-requests/[id]/approve
3. POST /api/admin/join-requests/[id]/reject
4. POST /api/join-requests

### REFACTOR Phase: Pending
After all tests pass, refactor for:
- Code quality
- Performance optimization
- DRY principles
- Error handling improvements

## Implementation Notes

### Database Schema Requirements

The tests expect the following database structure:

```sql
-- join_requests table
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
  reviewer_id UUID REFERENCES profiles(id)
);

-- RLS policies needed
- Users can view their own requests
- Admins can view requests for their organization
- Admins can approve/reject requests for their organization
- Users can create requests (if they don't have an organization)
```

### API Response Formats

**Success Response**:
```json
{
  "data": { /* join request object */ },
  "message": "Success message"
}
```

**Error Response**:
```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

### Test Organizations

**IMPORTANT**: Only use these test organizations in tests:
- 테스트병원 (Test Hospital)
- 대동병원 (Daedong Hospital)

Never use real organization data in tests.

## Next Steps

1. **Implement API endpoints** to make tests pass (GREEN phase)
2. **Verify all tests pass** after implementation
3. **Refactor code** while keeping tests green (REFACTOR phase)
4. **Update documentation** with implementation details
5. **Add E2E tests** for complete user workflows

## Dependencies

- Vitest: Test runner
- @testing-library/react: Testing utilities
- Supabase client: Database operations
- Next.js App Router: API routes

## Test Philosophy

These tests follow strict TDD principles:
- Tests written BEFORE implementation
- Tests verify behavior, not implementation
- Tests are independent and isolated
- Tests use descriptive names
- Tests cover happy paths and edge cases
- Tests validate authorization and security
