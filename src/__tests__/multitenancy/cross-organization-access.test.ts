/**
 * TDD Test Suite: Cross-Organization Data Access Prevention
 *
 * RED PHASE - These tests MUST fail initially
 *
 * Purpose: Verify that users from one organization cannot access,
 * modify, or delete data belonging to another organization.
 *
 * RLS Policy Requirements:
 * - SELECT: Users can only see data from their organization
 * - INSERT: Users can only create data for their organization
 * - UPDATE: Users can only modify data in their organization
 * - DELETE: Users can only delete data from their organization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockSupabaseClient,
  TEST_ORG_A_ID,
  TEST_ORG_B_ID,
  TEST_ADMIN_ORG_A_ID,
  TEST_NURSE_ORG_A_ID,
  TEST_PATIENT_ORG_B_ID,
  TEST_SCHEDULE_ORG_B_ID,
  TEST_ITEM_ORG_B_ID,
  expectRLSViolation,
  expectEmptyResult,
  validateTestPatientOnly,
} from './test-helpers'

describe('RED: Cross-Organization Data Access Prevention', () => {
  describe('Patients Table - Cross-Organization Access', () => {
    it('should prevent SELECT of patients from another organization', async () => {
      // ARRANGE: User from Org A trying to access Org B data
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select patients from Org B
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('organization_id', TEST_ORG_B_ID)

      // ASSERT: Should return empty result (RLS filters it out)
      expectEmptyResult(data, error)
    })

    it('should prevent INSERT of patient into another organization', async () => {
      // ARRANGE: User from Org A trying to insert into Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to insert patient with Org B's organization_id
      const { data, error } = await supabase
        .from('patients')
        .insert({
          patient_name: '테스트',
          patient_id: 'CROSS-TEST-001',
          organization_id: TEST_ORG_B_ID, // Wrong organization
        })
        .select()
        .single()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent UPDATE of patient in another organization', async () => {
      // ARRANGE: User from Org A trying to update Org B patient
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update patient from Org B
      const { data, error } = await supabase
        .from('patients')
        .update({ patient_name: '테스트환자' })
        .eq('id', TEST_PATIENT_ORG_B_ID)
        .select()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent DELETE of patient from another organization', async () => {
      // ARRANGE: User from Org A trying to delete Org B patient
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete patient from Org B
      const { data, error } = await supabase
        .from('patients')
        .delete()
        .eq('id', TEST_PATIENT_ORG_B_ID)

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should validate only test patients are used in tests', async () => {
      // ARRANGE: Get all test patients
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select patients
      const { data } = await supabase.from('patients').select('*')

      // ASSERT: Validate only test patients
      if (data) {
        validateTestPatientOnly(data)
      }
    })
  })

  describe('Schedules Table - Cross-Organization Access', () => {
    it('should prevent SELECT of schedules from another organization', async () => {
      // ARRANGE: Nurse from Org A trying to access Org B schedules
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select schedules from Org B
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('organization_id', TEST_ORG_B_ID)

      // ASSERT: Should return empty result
      expectEmptyResult(data, error)
    })

    it('should prevent INSERT of schedule into another organization', async () => {
      // ARRANGE: Nurse from Org A trying to insert into Org B
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to insert schedule with Org B's organization_id
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          patient_id: TEST_PATIENT_ORG_B_ID,
          patient_name: '테스트투',
          organization_id: TEST_ORG_B_ID,
          status: 'active',
        })
        .select()
        .single()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent UPDATE of schedule in another organization', async () => {
      // ARRANGE: Nurse from Org A trying to update Org B schedule
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update schedule from Org B
      const { data, error } = await supabase
        .from('schedules')
        .update({ status: 'cancelled' })
        .eq('id', TEST_SCHEDULE_ORG_B_ID)
        .select()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent DELETE of schedule from another organization', async () => {
      // ARRANGE: Nurse from Org A trying to delete Org B schedule
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete schedule from Org B
      const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', TEST_SCHEDULE_ORG_B_ID)

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should validate schedules only reference test patients', async () => {
      // ARRANGE: Get all schedules
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select schedules
      const { data } = await supabase.from('schedules').select('*')

      // ASSERT: Validate only test patients
      if (data) {
        validateTestPatientOnly(data)
      }
    })
  })

  describe('Items Table - Cross-Organization Access', () => {
    it('should prevent SELECT of items from another organization', async () => {
      // ARRANGE: User from Org A trying to access Org B items
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select items from Org B
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('organization_id', TEST_ORG_B_ID)

      // ASSERT: Should return empty result
      expectEmptyResult(data, error)
    })

    it('should prevent INSERT of item into another organization', async () => {
      // ARRANGE: User from Org A trying to insert into Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to insert item with Org B's organization_id
      const { data, error } = await supabase
        .from('items')
        .insert({
          item_name: '크로스테스트검사',
          item_category: 'test',
          organization_id: TEST_ORG_B_ID,
        })
        .select()
        .single()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent UPDATE of item in another organization', async () => {
      // ARRANGE: User from Org A trying to update Org B item
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update item from Org B
      const { data, error } = await supabase
        .from('items')
        .update({ item_name: '수정된검사' })
        .eq('id', TEST_ITEM_ORG_B_ID)
        .select()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent DELETE of item from another organization', async () => {
      // ARRANGE: User from Org A trying to delete Org B item
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete item from Org B
      const { data, error } = await supabase
        .from('items')
        .delete()
        .eq('id', TEST_ITEM_ORG_B_ID)

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Profiles Table - Cross-Organization Access', () => {
    it('should prevent viewing profiles from another organization', async () => {
      // ARRANGE: User from Org A trying to view Org B profiles
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to select profiles from Org B
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', TEST_ORG_B_ID)

      // ASSERT: Should return empty result
      expectEmptyResult(data, error)
    })

    it('should prevent updating profiles in another organization', async () => {
      // ARRANGE: Admin from Org A trying to update Org B user
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update profile from Org B
      const { data, error } = await supabase
        .from('profiles')
        .update({ name: '해킹된이름' })
        .eq('organization_id', TEST_ORG_B_ID)
        .select()

      // ASSERT: Should fail with RLS policy violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })
  })

  describe('Edge Cases - Cross-Organization Attacks', () => {
    it('should prevent organization_id spoofing in INSERT', async () => {
      // ARRANGE: User from Org A trying to spoof organization_id
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to insert with manipulated organization_id in request
      const { data, error } = await supabase
        .from('patients')
        .insert({
          patient_name: '테스트',
          patient_id: 'SPOOF-001',
          organization_id: TEST_ORG_B_ID, // Attempting to spoof
        })
        .select()
        .single()

      // ASSERT: Should fail - RLS must enforce auth.user's organization
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent organization_id change in UPDATE', async () => {
      // ARRANGE: User from Org A trying to steal data by changing org_id
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update own patient but change organization_id
      const { data, error } = await supabase
        .from('patients')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('patient_name', '테스트')
        .select()

      // ASSERT: Should fail - organization_id should be immutable via RLS
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent bulk operations across organizations', async () => {
      // ARRANGE: User from Org A trying bulk delete without org filter
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try bulk delete without organization filter
      const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('status', 'active')

      // ASSERT: Should only delete Org A schedules, not affect Org B
      expect(error).toBeNull()
      if (data) {
        data.forEach((schedule: any) => {
          expect(schedule.organization_id).toBe(TEST_ORG_A_ID)
        })
      }
    })
  })
})
