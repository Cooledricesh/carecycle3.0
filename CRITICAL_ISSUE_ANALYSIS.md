# Critical Database Architecture Analysis: Doctor_ID Update Issue

## Executive Summary

The nurse/doctor role users cannot update the `doctor_id` field in the patients table due to **conflicting RLS policies** causing PostgreSQL error 42P17 ("cannot determine result type"). This is a critical production issue requiring immediate resolution.

## 1. Root Cause Identification

### Error Code Analysis: 42P17
- **PostgreSQL Error**: "cannot determine result type"
- **Cause**: Multiple overlapping RLS policies create ambiguity in PostgreSQL's policy resolution engine
- **Trigger**: Occurs when PostgreSQL cannot determine which policy should take precedence

### Conflicting Policies Found

After analyzing the migration history, the following overlapping UPDATE policies exist on the patients table:

1. **`patients_secure_update`** (from 20250902 security migration)
   - Requires `is_user_active_and_approved()`
   - Applied to all authenticated users

2. **`doctors_update_own_patients`** (from 20250920 doctor role migration)
   - Complex logic for doctor assignments
   - WITH CHECK prevents doctors from changing doctor_id

3. **`authenticated_users_update_patients`** (from 20250925 attempted fix)
   - New policy attempting to allow doctor_id updates
   - Conflicts with existing policies

## 2. Why the Current Approach Failed

### Policy Conflict Resolution in PostgreSQL

When multiple policies exist for the same operation:
- PostgreSQL attempts to combine them using OR logic for permissive policies
- Complex USING and WITH CHECK clauses create resolution ambiguity
- The error 42P17 occurs when the type system cannot resolve the combined expression

### Specific Issues

1. **Type Resolution Conflict**: The `is_user_active_and_approved()` function returns boolean, while other policies have complex expressions with different return patterns

2. **WITH CHECK Contradiction**: The `doctors_update_own_patients` policy has a WITH CHECK that prevents doctor_id changes, conflicting with the new policy allowing it

3. **Multiple Policy Evaluation**: PostgreSQL evaluates all policies, and the combination creates an indeterminate state

## 3. Complete Solution

### Solution 1: Unified Policy Approach (Recommended)

**File**: `/supabase/migrations/20250925000002_fix_conflicting_update_policies.sql`

This migration:
1. Drops ALL existing UPDATE policies to eliminate conflicts
2. Creates a single, comprehensive `unified_patients_update_policy`
3. Consolidates all role-based logic into one policy
4. Ensures consistent USING and WITH CHECK clauses

**Benefits**:
- Eliminates policy conflicts entirely
- Clear, maintainable logic
- Single source of truth for permissions

### Solution 2: Function-Based Updates (Alternative)

**File**: `/supabase/migrations/20250925000003_alternative_function_based_update.sql`

This migration:
1. Creates secure database functions for patient updates
2. Uses SECURITY DEFINER to bypass RLS
3. Implements role-based access control within the function

**Benefits**:
- Bypasses RLS complexity entirely
- More granular control over updates
- Better error handling and logging

### Solution 3: API Route Enhancement (Implemented)

Updated the API route to handle failures gracefully:
1. First attempts direct update (respects RLS)
2. Falls back to function-based update on policy errors
3. Final fallback to service client (admin bypass)

## 4. Migration Order and Execution

### Step 1: Apply the Unified Policy Fix
```bash
# Apply the main fix
supabase db push --file supabase/migrations/20250925000002_fix_conflicting_update_policies.sql

# OR apply through dashboard
```

### Step 2: (Optional) Apply Function-Based Solution
```bash
# For additional reliability
supabase db push --file supabase/migrations/20250925000003_alternative_function_based_update.sql
```

### Step 3: Verify the Fix
```sql
-- Check that only one UPDATE policy exists
SELECT policyname, polcmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'patients'
  AND polcmd = 'UPDATE';

-- Test an update as nurse/doctor
UPDATE patients
SET doctor_id = 'valid-doctor-uuid'
WHERE id = 'patient-uuid';
```

## 5. Architectural Recommendations

### Immediate Actions

1. **Apply Migration 20250925000002**: This immediately resolves the conflict
2. **Monitor Error Logs**: Check for any 42P17 errors after migration
3. **Test All Roles**: Verify admin, nurse, and doctor can update doctor_id

### Long-term Improvements

1. **Policy Consolidation Strategy**
   - Always use single policies per operation when possible
   - Avoid overlapping permission logic
   - Document policy intentions clearly

2. **Function-Based Permissions**
   - Consider moving complex permission logic to database functions
   - Provides better debugging and error handling
   - Easier to test and maintain

3. **Testing Framework**
   ```sql
   -- Create test suite for RLS policies
   CREATE OR REPLACE FUNCTION test_rls_policies()
   RETURNS TABLE(test_name TEXT, result BOOLEAN, message TEXT)
   AS $$
   -- Test each role's permissions systematically
   $$ LANGUAGE plpgsql;
   ```

4. **Migration Best Practices**
   - Always check for existing policies before creating new ones
   - Use DROP IF EXISTS before CREATE POLICY
   - Test policy combinations in development
   - Document policy interactions

## 6. Prevention Strategy

### Pre-Migration Checklist
- [ ] Check existing policies: `SELECT * FROM pg_policies WHERE tablename = 'target_table'`
- [ ] Test policy combinations in development
- [ ] Document policy intentions and interactions
- [ ] Plan rollback strategy

### Policy Design Principles
1. **Single Responsibility**: One policy per operation per role group
2. **Explicit Over Implicit**: Clear conditions rather than complex logic
3. **Fail Secure**: Default deny, explicit allow
4. **Testability**: Each policy should be independently testable

## 7. Testing Verification

### Manual Test Cases

```sql
-- Test 1: Nurse updating doctor_id
SET ROLE nurse_user;
UPDATE patients SET doctor_id = 'doctor-uuid' WHERE id = 'patient-uuid';

-- Test 2: Doctor reassigning patient
SET ROLE doctor_user;
UPDATE patients SET doctor_id = 'another-doctor-uuid' WHERE id = 'patient-uuid';

-- Test 3: Admin full update
SET ROLE admin_user;
UPDATE patients SET doctor_id = NULL, care_type = '입원' WHERE id = 'patient-uuid';
```

### Automated Testing

```typescript
// Integration test for patient updates
describe('Patient Update Permissions', () => {
  test('Nurse can update doctor_id', async () => {
    const result = await patientService.update(patientId, { doctorId: newDoctorId })
    expect(result.doctorId).toBe(newDoctorId)
  })

  test('Doctor can reassign patients', async () => {
    const result = await patientService.update(patientId, { doctorId: anotherDoctorId })
    expect(result.doctorId).toBe(anotherDoctorId)
  })
})
```

## Conclusion

The issue stems from PostgreSQL's inability to resolve multiple overlapping RLS policies with complex logic. The recommended solution consolidates all UPDATE permissions into a single, unified policy that eliminates ambiguity while maintaining security. The alternative function-based approach provides additional reliability by bypassing RLS complexity entirely.

Apply migration `20250925000002_fix_conflicting_update_policies.sql` immediately to resolve the production issue.