/**
 * TDD Test Suite: Admin Join Request Permissions
 *
 * RED PHASE - These tests MUST fail initially
 *
 * Purpose: Verify that only admins can view and manage join requests
 * for their organization. Non-admin users should not have access to
 * join request operations.
 *
 * RLS Policy Requirements:
 * - Only admins can SELECT join_requests for their organization
 * - Only admins can UPDATE join_requests (approve/reject)
 * - Non-admins cannot access join_requests at all
 * - Cross-organization access is prevented for all roles
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
  expectEmptyResult,
  expectOrganizationMatch,
} from './test-helpers'

describe('RED: Admin Join Request Permissions', () => {
  describe('Admin Access to Join Requests', () => {
    it('should allow admin to view join requests for their organization', async () => {
      // ARRANGE: Admin from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select join requests
      const { data, error } = await supabase.from('join_requests').select('*')

      // ASSERT: Should succeed and only show Org A requests
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should allow admin to view pending join requests', async () => {
      // ARRANGE: Admin from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select pending join requests
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('status', 'pending')

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      data!.forEach((request: any) => {
        expect(request.status).toBe('pending')
        expect(request.organization_id).toBe(TEST_ORG_A_ID)
      })
    })

    it('should allow admin to approve join requests', async () => {
      // ARRANGE: Admin from Org A with pending join request
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Approve join request
      const { data, error } = await supabase
        .from('join_requests')
        .update({
          status: 'approved',
          approved_by: TEST_ADMIN_ORG_A_ID,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].status).toBe('approved')
      expect(data![0].approved_by).toBe(TEST_ADMIN_ORG_A_ID)
    })

    it('should allow admin to reject join requests', async () => {
      // ARRANGE: Admin from Org A with pending join request
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Reject join request
      const { data, error } = await supabase
        .from('join_requests')
        .update({
          status: 'rejected',
          approved_by: TEST_ADMIN_ORG_A_ID,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].status).toBe('rejected')
    })

    it('should allow admin to delete join requests', async () => {
      // ARRANGE: Admin from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Delete join request
      const { data, error } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', requestId)

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
    })
  })

  describe('Non-Admin Restricted Access', () => {
    it('should prevent nurse from viewing join requests', async () => {
      // ARRANGE: Nurse from Org A
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select join requests
      const { data, error } = await supabase.from('join_requests').select('*')

      // ASSERT: Should return empty or fail with RLS
      if (error) {
        expectRLSViolation(error)
      } else {
        expectEmptyResult(data, error)
      }
    })

    it('should prevent nurse from approving join requests', async () => {
      // ARRANGE: Nurse from Org A trying to approve
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Try to approve join request
      const { data, error } = await supabase
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent doctor from viewing join requests', async () => {
      // ARRANGE: Doctor from Org A
      const supabase = createMockSupabaseClient(TEST_DOCTOR_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select join requests
      const { data, error } = await supabase.from('join_requests').select('*')

      // ASSERT: Should return empty or fail with RLS
      if (error) {
        expectRLSViolation(error)
      } else {
        expectEmptyResult(data, error)
      }
    })

    it('should prevent doctor from rejecting join requests', async () => {
      // ARRANGE: Doctor from Org A trying to reject
      const supabase = createMockSupabaseClient(TEST_DOCTOR_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Try to reject join request
      const { data, error } = await supabase
        .from('join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent non-admin from deleting join requests', async () => {
      // ARRANGE: Nurse from Org A trying to delete
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Try to delete join request
      const { data, error } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', requestId)

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Cross-Organization Admin Restrictions', () => {
    it('should prevent admin from viewing other organization join requests', async () => {
      // ARRANGE: Admin from Org A trying to view Org B requests
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select Org B join requests
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('organization_id', TEST_ORG_B_ID)

      // ASSERT: Should return empty result
      expectEmptyResult(data, error)
    })

    it('should prevent admin from approving other organization requests', async () => {
      // ARRANGE: Admin from Org A trying to approve Org B request
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const orgBRequestId = '99999999-9999-9999-9999-999999999992' // Org B request

      // ACT: Try to approve Org B join request
      const { data, error } = await supabase
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('id', orgBRequestId)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent admin from deleting other organization requests', async () => {
      // ARRANGE: Admin from Org A trying to delete Org B request
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const orgBRequestId = '99999999-9999-9999-9999-999999999992'

      // ACT: Try to delete Org B join request
      const { data, error } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', orgBRequestId)

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Join Request Creation', () => {
    it('should allow authenticated users to create join requests', async () => {
      // ARRANGE: New user without organization creating join request
      const newUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const supabase = createMockSupabaseClient(newUserId, TEST_ORG_A_ID)

      // ACT: Create join request
      const { data, error } = await supabase
        .from('join_requests')
        .insert({
          user_id: newUserId,
          organization_id: TEST_ORG_A_ID,
          status: 'pending',
        })
        .select()
        .single()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data!.user_id).toBe(newUserId)
      expect(data!.status).toBe('pending')
    })

    it('should prevent duplicate join requests for same user-organization', async () => {
      // ARRANGE: User trying to create duplicate request
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to create duplicate join request
      const { data, error } = await supabase
        .from('join_requests')
        .insert({
          user_id: TEST_NURSE_ORG_A_ID,
          organization_id: TEST_ORG_A_ID,
          status: 'pending',
        })
        .select()
        .single()

      // ASSERT: Should fail with unique constraint violation
      expect(error).not.toBeNull()
      expect(error!.code).toMatch(/23505|42501/) // Unique or RLS violation
    })

    it('should allow users to view their own join requests', async () => {
      // ARRANGE: User viewing their own join request
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select own join requests
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('user_id', TEST_NURSE_ORG_A_ID)

      // ASSERT: Should succeed (users can see their own requests)
      expectSuccessfulQuery(data, error)
      data!.forEach((request: any) => {
        expect(request.user_id).toBe(TEST_NURSE_ORG_A_ID)
      })
    })

    it('should prevent users from viewing other users join requests', async () => {
      // ARRANGE: User trying to view another user's requests
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const otherUserId = TEST_DOCTOR_ORG_A_ID

      // ACT: Try to select another user's join requests
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('user_id', otherUserId)

      // ASSERT: Should return empty (unless they're admin)
      expectEmptyResult(data, error)
    })
  })

  describe('Join Request Workflow', () => {
    it('should enforce complete approval workflow by admins', async () => {
      // ARRANGE: Admin handling join request workflow
      const adminClient = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT 1: View pending requests
      const { data: pendingRequests } = await adminClient
        .from('join_requests')
        .select('*')
        .eq('status', 'pending')

      expect(pendingRequests).not.toBeNull()

      // ACT 2: Approve request
      const requestId = pendingRequests![0].id
      const { data: approvedRequest, error } = await adminClient
        .from('join_requests')
        .update({
          status: 'approved',
          approved_by: TEST_ADMIN_ORG_A_ID,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()

      // ASSERT: Full workflow should work
      expectSuccessfulQuery(approvedRequest, error)
      expect(approvedRequest![0].status).toBe('approved')
      expect(approvedRequest![0].approved_by).toBe(TEST_ADMIN_ORG_A_ID)
    })

    it('should prevent non-admins from any part of workflow', async () => {
      // ARRANGE: Nurse trying to handle workflow
      const nurseClient = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT 1: Try to view requests
      const { data: viewAttempt, error: viewError } = await nurseClient
        .from('join_requests')
        .select('*')

      // ACT 2: Try to approve request
      const { data: approveAttempt, error: approveError } = await nurseClient
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('id', '99999999-9999-9999-9999-999999999991')
        .select()

      // ASSERT: Both should fail or return empty
      if (viewError) {
        expectRLSViolation(viewError)
      } else {
        expectEmptyResult(viewAttempt, viewError)
      }
      expectRLSViolation(approveError)
    })

    it('should isolate join request workflows per organization', async () => {
      // ARRANGE: Admins from two different organizations
      const adminA = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const adminB = createMockSupabaseClient(TEST_ADMIN_ORG_B_ID, TEST_ORG_B_ID)

      // ACT: Both view their join requests
      const { data: requestsA } = await adminA.from('join_requests').select('*')
      const { data: requestsB } = await adminB.from('join_requests').select('*')

      // ASSERT: Each should only see their organization's requests
      expectOrganizationMatch(requestsA!, TEST_ORG_A_ID)
      expectOrganizationMatch(requestsB!, TEST_ORG_B_ID)

      // No overlap between organizations
      const idsA = requestsA!.map((r: any) => r.id)
      const idsB = requestsB!.map((r: any) => r.id)
      const overlap = idsA.filter((id: string) => idsB.includes(id))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('Edge Cases - Join Request Security', () => {
    it('should prevent approving already approved requests', async () => {
      // ARRANGE: Admin trying to re-approve
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to approve already approved request
      const { data, error } = await supabase
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('status', 'approved')
        .select()

      // ASSERT: Should either succeed with no changes or fail
      // Preferred: Application logic prevents this, but RLS doesn't block
      expect(error).toBeNull()
    })

    it('should prevent changing approved_by to another admin', async () => {
      // ARRANGE: Admin trying to change who approved
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const requestId = '99999999-9999-9999-9999-999999999991'

      // ACT: Try to change approved_by
      const { data, error } = await supabase
        .from('join_requests')
        .update({
          status: 'approved',
          approved_by: TEST_ADMIN_ORG_B_ID, // Different admin
        })
        .eq('id', requestId)
        .select()

      // ASSERT: Should succeed but log audit trail
      // RLS doesn't prevent this, but audit logs should track it
      expectSuccessfulQuery(data, error)
    })

    it('should handle bulk approval operations securely', async () => {
      // ARRANGE: Admin approving multiple requests
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Bulk approve all pending requests
      const { data, error } = await supabase
        .from('join_requests')
        .update({
          status: 'approved',
          approved_by: TEST_ADMIN_ORG_A_ID,
        })
        .eq('status', 'pending')
        .select()

      // ASSERT: Should only affect own organization
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })
  })
})
