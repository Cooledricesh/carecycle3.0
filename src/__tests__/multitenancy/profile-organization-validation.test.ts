/**
 * TDD Test Suite: Profile Organization ID Validation
 *
 * RED PHASE - These tests MUST fail initially
 *
 * Purpose: Verify that profile organization_id field is properly validated
 * and secured. Users cannot change their own organization_id, and only
 * admins can assign organization_id when approving join requests.
 *
 * RLS Policy Requirements:
 * - All profiles must have organization_id (NOT NULL after approval)
 * - Users cannot change their own organization_id
 * - Only admins can assign organization_id to users in their org
 * - Profile updates are scoped to user's organization
 * - Users can only view profiles in their organization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockSupabaseClient,
  TEST_ORG_A_ID,
  TEST_ORG_B_ID,
  TEST_ADMIN_ORG_A_ID,
  TEST_NURSE_ORG_A_ID,
  TEST_DOCTOR_ORG_A_ID,
  TEST_ADMIN_ORG_B_ID,
  expectSuccessfulQuery,
  expectRLSViolation,
  expectOrganizationMatch,
} from './test-helpers'

describe('RED: Profile Organization ID Validation', () => {
  describe('Profile Creation with Organization', () => {
    it('should require organization_id for approved profiles', async () => {
      // ARRANGE: Creating profile without organization_id
      const newUserId = 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Try to create approved profile without organization
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: 'test@example.com',
          name: '테스트사용자',
          role: 'nurse',
          approval_status: 'approved',
          // organization_id missing
        })
        .select()
        .single()

      // ASSERT: Should fail - organization_id required for approved profiles
      expect(error).not.toBeNull()
      expect(error!.code).toMatch(/23502|23514/) // Not null or check constraint
    })

    it('should allow pending profiles without organization_id', async () => {
      // ARRANGE: Creating pending profile
      const newUserId = 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create pending profile without organization
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: 'pending@example.com',
          name: '대기중사용자',
          role: 'nurse',
          approval_status: 'pending',
          organization_id: null,
        })
        .select()
        .single()

      // ASSERT: Should succeed - pending profiles can be without org
      expectSuccessfulQuery(data, error)
      expect(data!.organization_id).toBeNull()
      expect(data!.approval_status).toBe('pending')
    })

    it('should auto-set organization_id when creating profile', async () => {
      // ARRANGE: Admin creating new user profile
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const newUserId = 'ssssssss-ssss-ssss-ssss-ssssssssssss'

      // ACT: Create profile without explicit organization_id
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: 'newuser@example.com',
          name: '신규사용자',
          role: 'nurse',
          approval_status: 'approved',
          // organization_id should be auto-set to admin's org
        })
        .select()
        .single()

      // ASSERT: Should auto-set organization_id
      expectSuccessfulQuery(data, error)
      expect(data!.organization_id).toBe(TEST_ORG_A_ID)
    })
  })

  describe('User Self-Update Restrictions', () => {
    it('should prevent user from changing their own organization_id', async () => {
      // ARRANGE: User trying to change their organization
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change organization_id
      const { data, error } = await supabase
        .from('profiles')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should allow user to update their own non-organization fields', async () => {
      // ARRANGE: User updating their profile
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Update allowed fields
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: '업데이트된이름',
          phone: '010-1234-5678',
        })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].name).toBe('업데이트된이름')
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID) // Unchanged
    })

    it('should prevent user from changing their role', async () => {
      // ARRANGE: Nurse trying to become admin
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change role
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should fail - only admins can change roles
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent user from changing approval_status', async () => {
      // ARRANGE: User trying to self-approve
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change approval status
      const { data, error } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should fail - only admins can approve
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Admin Organization Assignment', () => {
    it('should allow admin to assign organization_id to pending users', async () => {
      // ARRANGE: Admin approving pending user
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const pendingUserId = 'tttttttt-tttt-tttt-tttt-tttttttttttt'

      // ACT: Assign organization and approve
      const { data, error } = await supabase
        .from('profiles')
        .update({
          organization_id: TEST_ORG_A_ID,
          approval_status: 'approved',
          approved_by: TEST_ADMIN_ORG_A_ID,
          approved_at: new Date().toISOString(),
        })
        .eq('id', pendingUserId)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID)
      expect(data![0].approval_status).toBe('approved')
    })

    it('should allow admin to change user roles in their org', async () => {
      // ARRANGE: Admin promoting nurse to doctor
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Change user role
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'doctor' })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].role).toBe('doctor')
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should prevent admin from assigning users to other organizations', async () => {
      // ARRANGE: Admin from Org A trying to assign to Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const pendingUserId = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu'

      // ACT: Try to assign to different organization
      const { data, error } = await supabase
        .from('profiles')
        .update({
          organization_id: TEST_ORG_B_ID, // Different org
          approval_status: 'approved',
        })
        .eq('id', pendingUserId)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent non-admin from assigning organization_id', async () => {
      // ARRANGE: Nurse trying to approve pending user
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const pendingUserId = 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv'

      // ACT: Try to assign organization
      const { data, error } = await supabase
        .from('profiles')
        .update({
          organization_id: TEST_ORG_A_ID,
          approval_status: 'approved',
        })
        .eq('id', pendingUserId)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Profile Viewing Restrictions', () => {
    it('should only show profiles from user organization', async () => {
      // ARRANGE: User from Org A viewing profiles
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: View all profiles
      const { data, error } = await supabase.from('profiles').select('*')

      // ASSERT: Should only return Org A profiles
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should prevent viewing profiles from other organizations', async () => {
      // ARRANGE: User from Org A trying to view Org B profile
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to view Org B profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', TEST_ADMIN_ORG_B_ID)

      // ASSERT: Should return empty
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('should allow users to view their own profile', async () => {
      // ARRANGE: User viewing own profile
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: View own profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', TEST_NURSE_ORG_A_ID)
        .single()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data!.id).toBe(TEST_NURSE_ORG_A_ID)
      expect(data!.organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should show pending profiles to admins for approval', async () => {
      // ARRANGE: Admin viewing pending profiles
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: View pending profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      data!.forEach((profile: any) => {
        expect(profile.approval_status).toBe('pending')
      })
    })
  })

  describe('Organization Transfer Restrictions', () => {
    it('should prevent organization transfer via direct update', async () => {
      // ARRANGE: Admin trying to transfer user to another org
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change user's organization
      const { data, error } = await supabase
        .from('profiles')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should fail - organization transfers not allowed
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should require proper workflow for organization changes', async () => {
      // ARRANGE: User wanting to change organizations
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change organization_id
      const { data, error } = await supabase
        .from('profiles')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should fail - must go through join request
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should maintain organization_id immutability after approval', async () => {
      // ARRANGE: Various users trying to change organization
      const nurseClient = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const adminClient = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Both try to change organization
      const { error: nurseError } = await nurseClient
        .from('profiles')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      const { error: adminError } = await adminClient
        .from('profiles')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Both should fail
      expectRLSViolation(nurseError)
      expectRLSViolation(adminError)
    })
  })

  describe('Profile Deletion Restrictions', () => {
    it('should prevent users from deleting their own profile', async () => {
      // ARRANGE: User trying to delete themselves
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete own profile
      const { data, error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', TEST_NURSE_ORG_A_ID)

      // ASSERT: Should fail - profile deletion restricted
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should allow admin to deactivate users in their org', async () => {
      // ARRANGE: Admin deactivating user
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Deactivate user
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', TEST_NURSE_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].is_active).toBe(false)
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID) // Unchanged
    })

    it('should prevent admin from deleting users in other orgs', async () => {
      // ARRANGE: Admin from Org A trying to delete Org B user
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete Org B user
      const { data, error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', TEST_ADMIN_ORG_B_ID)

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Edge Cases - Profile Organization Validation', () => {
    it('should handle NULL organization_id properly', async () => {
      // ARRANGE: Pending profile with NULL organization
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Query profiles with NULL organization_id
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .is('organization_id', null)

      // ASSERT: Should return pending profiles only
      expectSuccessfulQuery(data, error)
      data!.forEach((profile: any) => {
        expect(profile.approval_status).toBe('pending')
      })
    })

    it('should prevent invalid organization_id foreign key', async () => {
      // ARRANGE: Creating profile with non-existent organization
      const newUserId = 'wwwwwwww-wwww-wwww-wwww-wwwwwwwwwwww'
      const supabase = createMockSupabaseClient(newUserId, '')
      const fakeOrgId = 'fake-org-id-12345'

      // ACT: Try to create profile with invalid org_id
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: 'invalid@example.com',
          name: '잘못된조직',
          role: 'nurse',
          organization_id: fakeOrgId,
        })
        .select()
        .single()

      // ASSERT: Should fail with foreign key violation
      expect(error).not.toBeNull()
      expect(error!.code).toBe('23503') // Foreign key violation
    })

    it('should handle organization_id in WHERE clauses safely', async () => {
      // ARRANGE: User querying with organization_id filter
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Query with explicit organization filter
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', TEST_ORG_A_ID)

      // ASSERT: Should only return Org A profiles (RLS enforced)
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should prevent organization_id injection attacks', async () => {
      // ARRANGE: Malicious user trying SQL injection
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try injection in organization_id field
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', `${TEST_ORG_A_ID}' OR '1'='1`)

      // ASSERT: Should safely handle - no injection
      expect(error).not.toBeNull() // Invalid UUID format
    })

    it('should enforce referential integrity on organization deletion', async () => {
      // ARRANGE: Deleting organization with users
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete organization
      const { error: orgError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', TEST_ORG_A_ID)

      // Check profile integrity
      const { data: orphanedProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', TEST_ORG_A_ID)

      // ASSERT: Should handle cascade or restrict properly
      if (orgError) {
        // Restrict: Cannot delete org with users
        expect(orgError.code).toBe('23503')
      } else {
        // Cascade: Profiles should be handled
        expect(orphanedProfiles).toHaveLength(0)
      }
    })
  })
})
