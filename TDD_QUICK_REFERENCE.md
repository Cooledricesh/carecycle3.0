# TDD Quick Reference - Organization Signup Feature

## Current Status: RED Phase Complete ✅

All tests are written and **failing as expected**. Ready to move to GREEN phase.

## Test Files

| File | Tests | Status |
|------|-------|--------|
| `src/__tests__/services/organization.test.ts` | 22 | 15 failing ✅ |
| `src/__tests__/components/auth/organization-signup.test.tsx` | 29 | 29 failing ✅ |
| `src/__tests__/database/organization-rpc.test.ts` | 22+ | Ready to run |

## Quick Commands

```bash
# Run all organization tests
npm test -- organization --run

# Run specific test file
npm test -- src/__tests__/services/organization.test.ts --run
npm test -- src/__tests__/components/auth/organization-signup.test.tsx --run

# Watch mode (recommended for TDD)
npm run test:watch -- organization

# Run single test
npm test -- -t "should validate organization name"
```

## Test Scenarios Covered

### Organization Name Validation
- ❌ Empty name → "조직 이름을 입력해주세요."
- ❌ Whitespace only → "조직 이름을 입력해주세요."
- ❌ < 2 characters → "조직 이름은 2자 이상 100자 이하여야 합니다."
- ❌ > 100 characters → "조직 이름은 2자 이상 100자 이하여야 합니다."
- ❌ Valid name (2-100 chars) → accepted
- ❌ Whitespace trimming → automatic

### Organization Search
- ❌ Case-insensitive search
- ❌ Partial name matching
- ❌ Empty results handling
- ❌ Error handling

### Organization Creation
- ❌ Create with unique name
- ❌ Reject duplicate names
- ❌ Atomic transaction (all or nothing)
- ❌ Set user as first admin
- ❌ Update user profile with org_id

### UI Interactions
- ❌ Choose between create/join
- ❌ Search existing organizations
- ❌ Input validation with live feedback
- ❌ Loading states
- ❌ Error messages
- ❌ Accessibility (ARIA, keyboard)

## Implementation Checklist

### Phase 1: Database (GREEN - Step 1)
- [ ] Create organizations table
- [ ] Add organization_id to profiles
- [ ] Create RPC function: create_organization_and_register_user
- [ ] Add indexes for performance
- [ ] Set up RLS policies

**Migration File**: `supabase/migrations/YYYYMMDD######_add_organizations.sql`

### Phase 2: Service Layer (GREEN - Step 2)
- [ ] Create `src/services/organization.ts`
- [ ] Implement validateOrganizationName()
- [ ] Implement searchOrganizations()
- [ ] Implement createOrganization()
- [ ] Implement createOrganizationAndRegisterUser()
- [ ] Run tests: should see 15→22 tests passing

### Phase 3: UI Component (GREEN - Step 3)
- [ ] Create `src/components/auth/organization-signup-form.tsx`
- [ ] Implement create/join option selection
- [ ] Implement organization search with debounce
- [ ] Implement organization creation form
- [ ] Add validation and error handling
- [ ] Add loading states
- [ ] Ensure accessibility
- [ ] Run tests: should see all 29 tests passing

### Phase 4: Integration (GREEN - Step 4)
- [ ] Update `src/app/api/auth/signup/route.ts`
- [ ] Add organization flow after user creation
- [ ] Test end-to-end signup flow
- [ ] Run all tests: should see 51+ tests passing

### Phase 5: Refactor (REFACTOR)
- [ ] Extract common validation logic
- [ ] Optimize database queries
- [ ] Improve error messages
- [ ] Add TypeScript types
- [ ] Document complex logic
- [ ] Run tests: ensure all still pass

## Test Data (Use Only These)

```typescript
// Approved test organizations
const TEST_ORGS = [
  '테스트병원',      // Test Hospital
  '테스트새병원',    // Test New Hospital
  '테스트환자',      // Test Patient (for other tests)
];

// Test user
const TEST_USER = {
  email: 'test@example.com',
  name: '테스트유저',
  role: 'admin'
};
```

## Expected Test Results

### After Database Migration (Phase 1)
```
✅ Database RPC tests: 22/22 passing
❌ Service layer tests: 15/22 failing (RPC working, service layer not)
❌ Component tests: 29/29 failing
```

### After Service Layer (Phase 2)
```
✅ Database RPC tests: 22/22 passing
✅ Service layer tests: 22/22 passing
❌ Component tests: 29/29 failing
```

### After UI Component (Phase 3)
```
✅ Database RPC tests: 22/22 passing
✅ Service layer tests: 22/22 passing
✅ Component tests: 29/29 passing
```

### After Integration (Phase 4)
```
✅ All tests: 51+/51+ passing
✅ End-to-end flow working
```

## Common Issues & Solutions

### Issue: Tests timeout
**Solution**: Check Supabase connection, ensure dev server is running

### Issue: Mock not working
**Solution**: Ensure vi.mock() is at top of file, before imports

### Issue: Component tests fail to render
**Solution**: Check for missing 'use client' directive

### Issue: Database tests fail with auth error
**Solution**: Use createServiceClient() for admin operations

## Next Actions

1. **Start GREEN Phase**: Begin with database migration
2. **Run tests frequently**: After each small change
3. **Commit when green**: Only commit when tests pass
4. **Refactor carefully**: Keep tests passing during refactoring

## TDD Mantra

- **RED**: Test fails → ✅ Done
- **GREEN**: Make it pass → 🚧 Next
- **REFACTOR**: Make it better → ⏳ After GREEN

## Links

- Full test suite documentation: `/TDD_ORGANIZATION_SIGNUP_TESTS.md`
- TDD guidelines: `/docs/tdd.md`
- Service layer tests: `/src/__tests__/services/organization.test.ts`
- Component tests: `/src/__tests__/components/auth/organization-signup.test.tsx`
- RPC tests: `/src/__tests__/database/organization-rpc.test.ts`
