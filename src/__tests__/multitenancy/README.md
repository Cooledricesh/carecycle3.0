# Multitenancy RLS Test Suite

## Overview

Comprehensive TDD test suite for Row Level Security (RLS) policies in the multitenancy implementation. These tests follow the **RED-GREEN-REFACTOR** cycle and are designed to **fail initially** (RED phase) before implementation.

## Test Structure

### Test Files

1. **test-helpers.ts** - Mock utilities and helper functions
   - Mock Supabase client factory
   - Test data generators
   - Assertion helpers
   - Test patient validation

2. **cross-organization-access.test.ts** - Cross-organization isolation
   - Prevents SELECT across organizations
   - Prevents INSERT into other organizations
   - Prevents UPDATE of other organization data
   - Prevents DELETE from other organizations
   - Edge cases and attack vectors

3. **organization-specific-access.test.ts** - Organization-scoped operations
   - Auto-filtering SELECT to user's organization
   - Auto-setting organization_id on INSERT
   - Organization-scoped UPDATE operations
   - Organization-scoped DELETE operations
   - Role-based access within organization

4. **admin-join-requests.test.ts** - Admin-only join request management
   - Admin can view/approve/reject join requests
   - Non-admins cannot access join requests
   - Cross-organization restrictions for admins
   - Join request creation workflow

5. **organization-creation.test.ts** - Organization creation and management
   - Any user can create organizations
   - Creator becomes first admin
   - Organization name uniqueness
   - Organization update/delete permissions

6. **profile-organization-validation.test.ts** - Profile organization_id security
   - organization_id immutability for users
   - Admin-only organization assignment
   - Profile viewing restrictions
   - Organization transfer prevention

## Running Tests

### Run All Multitenancy Tests
```bash
npm run test:unit -- src/__tests__/multitenancy
```

### Run Specific Test Suite
```bash
npm run test:unit -- src/__tests__/multitenancy/cross-organization-access.test.ts
npm run test:unit -- src/__tests__/multitenancy/organization-specific-access.test.ts
npm run test:unit -- src/__tests__/multitenancy/admin-join-requests.test.ts
npm run test:unit -- src/__tests__/multitenancy/organization-creation.test.ts
npm run test:unit -- src/__tests__/multitenancy/profile-organization-validation.test.ts
```

### Watch Mode (TDD)
```bash
npm run test:unit -- --watch src/__tests__/multitenancy
```

## TDD Workflow

### RED Phase (Current)
All tests are designed to **FAIL** initially. Run tests to verify they fail:

```bash
npm run test:unit -- src/__tests__/multitenancy
```

Expected result: **All tests should fail** because RLS policies are not implemented yet.

### GREEN Phase (Next)
After implementing RLS policies in migration files:

1. Apply the multitenancy migration to database
2. Re-run tests
3. Tests should now **PASS**

### REFACTOR Phase (Final)
Once all tests pass:

1. Review RLS policy implementations
2. Optimize query performance
3. Clean up redundant policies
4. Ensure tests still pass

## Test Data

### Test Organizations
- **Org A**: `00000000-0000-0000-0000-000000000001` - '테스트병원A'
- **Org B**: `00000000-0000-0000-0000-000000000002` - '테스트병원B'

### Test Users
**Organization A:**
- Admin: `11111111-1111-1111-1111-111111111111`
- Nurse: `11111111-1111-1111-1111-111111111112`
- Doctor: `11111111-1111-1111-1111-111111111113`

**Organization B:**
- Admin: `22222222-2222-2222-2222-222222222221`
- Nurse: `22222222-2222-2222-2222-222222222222`
- Doctor: `22222222-2222-2222-2222-222222222223`

### Test Patients
Only these patient names are allowed in tests:
- '테스트'
- '테스트투'
- '테스트환자'

**CRITICAL**: Never use real patient data in tests.

## Test Coverage

### Tables Covered
- ✅ `organizations` - Organization CRUD and permissions
- ✅ `profiles` - User profile and organization assignment
- ✅ `patients` - Patient data isolation
- ✅ `schedules` - Schedule data isolation
- ✅ `items` - Item data isolation
- ✅ `join_requests` - Admin-only join request management

### Operations Covered
- ✅ SELECT - Organization-scoped queries
- ✅ INSERT - Auto-set organization_id
- ✅ UPDATE - Organization-scoped updates
- ✅ DELETE - Organization-scoped deletions

### Security Scenarios
- ✅ Cross-organization data access prevention
- ✅ Organization-specific data filtering
- ✅ Admin-only operations
- ✅ User self-update restrictions
- ✅ organization_id immutability
- ✅ SQL injection prevention
- ✅ Foreign key validation

## Expected Failures (RED Phase)

When you first run these tests, expect these types of failures:

```
❌ RLS policies not found
❌ organization_id column missing
❌ Cross-organization queries return data they shouldn't
❌ Users can change their own organization_id
❌ Non-admins can access join_requests
❌ Organization names not enforced as unique
```

## Implementation Checklist

After implementing RLS policies, verify:

- [ ] All tables have organization_id column
- [ ] RLS is enabled on all tables
- [ ] SELECT policies filter by organization_id
- [ ] INSERT policies auto-set organization_id
- [ ] UPDATE policies enforce organization scope
- [ ] DELETE policies enforce organization scope
- [ ] Admin-only policies for join_requests
- [ ] organization_id is immutable for users
- [ ] Foreign key constraints in place
- [ ] Unique constraints on organization names

## Helper Functions

### Mock Supabase Client
```typescript
import { createMockSupabaseClient } from './test-helpers'

const supabase = createMockSupabaseClient(userId, organizationId)
```

### Assertion Helpers
```typescript
import {
  expectRLSViolation,
  expectSuccessfulQuery,
  expectEmptyResult,
  expectOrganizationMatch,
  validateTestPatientOnly,
} from './test-helpers'

// Assert RLS policy violation
expectRLSViolation(error)

// Assert successful query
expectSuccessfulQuery(data, error)

// Assert empty result (filtered by RLS)
expectEmptyResult(data, error)

// Assert all data belongs to expected organization
expectOrganizationMatch(data, TEST_ORG_A_ID)

// Assert only test patients used
validateTestPatientOnly(data)
```

## Notes

- Tests use Vitest with @testing-library/react
- Mock Supabase client simulates RLS behavior
- Test data is isolated and safe
- All test patients follow naming convention
- Tests are independent and can run in any order

## Next Steps

1. **RED**: Verify all tests fail ✅ (You are here)
2. **GREEN**: Implement RLS policies in migration
3. **REFACTOR**: Optimize and clean up policies
4. **DEPLOY**: Apply migration to staging/production

## References

- TDD Methodology: `/docs/tdd.md`
- CLAUDE.md Guidelines: `/CLAUDE.md`
- Multitenancy Plan: `/docs/multitenancy-implementation-plan.md`
