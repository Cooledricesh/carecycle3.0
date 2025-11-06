/**
 * TDD Test Suite: Organization-Specific Data Access
 *
 * RED PHASE - These tests MUST fail initially
 *
 * Purpose: Verify that users can ONLY access data from their own organization.
 * All operations (SELECT, INSERT, UPDATE, DELETE) should be automatically
 * scoped to the user's organization.
 *
 * RLS Policy Requirements:
 * - Auto-filter all SELECT queries to user's organization
 * - Auto-set organization_id on INSERT to user's organization
 * - Only allow UPDATE on user's organization data
 * - Only allow DELETE on user's organization data
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
  TEST_PATIENT_ORG_A_ID,
  TEST_SCHEDULE_ORG_A_ID,
  TEST_ITEM_ORG_A_ID,
  expectSuccessfulQuery,
  expectOrganizationMatch,
  validateTestPatientOnly,
} from './test-helpers'

describe('RED: Organization-Specific Data Access', () => {
  describe('SELECT Operations - Automatic Organization Filtering', () => {
    it('should automatically filter patients to user organization', async () => {
      // ARRANGE: User from Org A querying patients
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select all patients (no organization filter in query)
      const { data, error } = await supabase.from('patients').select('*')

      // ASSERT: Should only return Org A patients
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
      validateTestPatientOnly(data!)
    })

    it('should automatically filter schedules to user organization', async () => {
      // ARRANGE: Nurse from Org A querying schedules
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select all schedules
      const { data, error } = await supabase.from('schedules').select('*')

      // ASSERT: Should only return Org A schedules
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should automatically filter items to user organization', async () => {
      // ARRANGE: Doctor from Org A querying items
      const supabase = createMockSupabaseClient(TEST_DOCTOR_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select all items
      const { data, error } = await supabase.from('items').select('*')

      // ASSERT: Should only return Org A items
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should automatically filter profiles to user organization', async () => {
      // ARRANGE: Admin from Org A querying profiles
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Select all profiles
      const { data, error } = await supabase.from('profiles').select('*')

      // ASSERT: Should only return Org A profiles
      expectSuccessfulQuery(data, error)
      expectOrganizationMatch(data!, TEST_ORG_A_ID)
    })

    it('should work correctly for multiple organizations independently', async () => {
      // ARRANGE: Two users from different organizations
      const supabaseOrgA = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const supabaseOrgB = createMockSupabaseClient(TEST_ADMIN_ORG_B_ID, TEST_ORG_B_ID)

      // ACT: Both query patients
      const { data: dataA, error: errorA } = await supabaseOrgA
        .from('patients')
        .select('*')
      const { data: dataB, error: errorB } = await supabaseOrgB
        .from('patients')
        .select('*')

      // ASSERT: Each should only see their organization's data
      expectSuccessfulQuery(dataA, errorA)
      expectSuccessfulQuery(dataB, errorB)
      expectOrganizationMatch(dataA!, TEST_ORG_A_ID)
      expectOrganizationMatch(dataB!, TEST_ORG_B_ID)
    })
  })

  describe('INSERT Operations - Automatic Organization Assignment', () => {
    it('should automatically set organization_id on patient insert', async () => {
      // ARRANGE: User from Org A inserting new patient
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Insert patient WITHOUT specifying organization_id
      const { data, error } = await supabase
        .from('patients')
        .insert({
          patient_name: '테스트',
          patient_id: 'AUTO-ORG-001',
          // Note: organization_id NOT specified - should be auto-set
        })
        .select()
        .single()

      // ASSERT: Should succeed and have correct organization_id
      expectSuccessfulQuery(data, error)
      expect(data!.organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should automatically set organization_id on schedule insert', async () => {
      // ARRANGE: Nurse from Org A creating schedule
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Insert schedule without organization_id
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          patient_id: TEST_PATIENT_ORG_A_ID,
          patient_name: '테스트',
          status: 'active',
          // organization_id should be auto-set
        })
        .select()
        .single()

      // ASSERT: Should succeed with correct organization_id
      expectSuccessfulQuery(data, error)
      expect(data!.organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should automatically set organization_id on item insert', async () => {
      // ARRANGE: Admin from Org A creating item
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Insert item without organization_id
      const { data, error } = await supabase
        .from('items')
        .insert({
          item_name: '자동조직검사',
          item_category: 'test',
          // organization_id should be auto-set
        })
        .select()
        .single()

      // ASSERT: Should succeed with correct organization_id
      expectSuccessfulQuery(data, error)
      expect(data!.organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should override incorrect organization_id in insert', async () => {
      // ARRANGE: User from Org A trying to set wrong organization_id
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to insert with wrong organization_id
      const { data, error } = await supabase
        .from('patients')
        .insert({
          patient_name: '테스트',
          patient_id: 'OVERRIDE-001',
          organization_id: TEST_ORG_B_ID, // Wrong - should be overridden
        })
        .select()
        .single()

      // ASSERT: Should either fail OR force correct organization_id
      // Preferred: Fail with RLS violation
      // Alternative: Override to TEST_ORG_A_ID
      if (error) {
        expect(error.code).toBe('42501')
      } else {
        expect(data!.organization_id).toBe(TEST_ORG_A_ID)
      }
    })
  })

  describe('UPDATE Operations - Organization Scope Enforcement', () => {
    it('should only allow updating own organization patients', async () => {
      // ARRANGE: User from Org A updating their patient
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Update patient in same organization
      const { data, error } = await supabase
        .from('patients')
        .update({ patient_name: '테스트환자' })
        .eq('id', TEST_PATIENT_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should only allow updating own organization schedules', async () => {
      // ARRANGE: Nurse from Org A updating their schedule
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Update schedule in same organization
      const { data, error } = await supabase
        .from('schedules')
        .update({ status: 'paused' })
        .eq('id', TEST_SCHEDULE_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should only allow updating own organization items', async () => {
      // ARRANGE: Admin from Org A updating their item
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Update item in same organization
      const { data, error } = await supabase
        .from('items')
        .update({ item_name: '업데이트된검사' })
        .eq('id', TEST_ITEM_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].organization_id).toBe(TEST_ORG_A_ID)
    })

    it('should prevent changing organization_id in update', async () => {
      // ARRANGE: User trying to change organization_id
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to change organization_id
      const { data, error } = await supabase
        .from('patients')
        .update({ organization_id: TEST_ORG_B_ID })
        .eq('id', TEST_PATIENT_ORG_A_ID)
        .select()

      // ASSERT: Should fail - organization_id should be immutable
      expect(error).not.toBeNull()
      expect(error!.code).toBe('42501')
    })
  })

  describe('DELETE Operations - Organization Scope Enforcement', () => {
    it('should only allow deleting own organization patients', async () => {
      // ARRANGE: User from Org A deleting their patient
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete patient from same organization
      const { data, error } = await supabase
        .from('patients')
        .delete()
        .eq('id', TEST_PATIENT_ORG_A_ID)

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
    })

    it('should only allow deleting own organization schedules', async () => {
      // ARRANGE: Nurse from Org A deleting their schedule
      const supabase = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete schedule from same organization
      const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', TEST_SCHEDULE_ORG_A_ID)

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
    })

    it('should only allow deleting own organization items', async () => {
      // ARRANGE: Admin from Org A deleting their item
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete item from same organization
      const { data, error } = await supabase
        .from('items')
        .delete()
        .eq('id', TEST_ITEM_ORG_A_ID)

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
    })
  })

  describe('Role-Based Access Within Organization', () => {
    it('should allow all roles to read data within organization', async () => {
      // ARRANGE: Different roles from same organization
      const adminClient = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)
      const nurseClient = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const doctorClient = createMockSupabaseClient(TEST_DOCTOR_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: All roles query patients
      const { data: adminData, error: adminError } = await adminClient
        .from('patients')
        .select('*')
      const { data: nurseData, error: nurseError } = await nurseClient
        .from('patients')
        .select('*')
      const { data: doctorData, error: doctorError } = await doctorClient
        .from('patients')
        .select('*')

      // ASSERT: All should succeed with same data
      expectSuccessfulQuery(adminData, adminError)
      expectSuccessfulQuery(nurseData, nurseError)
      expectSuccessfulQuery(doctorData, doctorError)
      expectOrganizationMatch(adminData!, TEST_ORG_A_ID)
      expectOrganizationMatch(nurseData!, TEST_ORG_A_ID)
      expectOrganizationMatch(doctorData!, TEST_ORG_A_ID)
    })

    it('should allow all clinical roles to create schedules', async () => {
      // ARRANGE: Nurse and doctor from same organization
      const nurseClient = createMockSupabaseClient(TEST_NURSE_ORG_A_ID, TEST_ORG_A_ID)
      const doctorClient = createMockSupabaseClient(TEST_DOCTOR_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Both create schedules
      const { data: nurseSchedule, error: nurseError } = await nurseClient
        .from('schedules')
        .insert({
          patient_id: TEST_PATIENT_ORG_A_ID,
          patient_name: '테스트',
          status: 'active',
        })
        .select()
        .single()

      const { data: doctorSchedule, error: doctorError } = await doctorClient
        .from('schedules')
        .insert({
          patient_id: TEST_PATIENT_ORG_A_ID,
          patient_name: '테스트',
          status: 'active',
        })
        .select()
        .single()

      // ASSERT: Both should succeed
      expectSuccessfulQuery(nurseSchedule, nurseError)
      expectSuccessfulQuery(doctorSchedule, doctorError)
      expect(nurseSchedule!.organization_id).toBe(TEST_ORG_A_ID)
      expect(doctorSchedule!.organization_id).toBe(TEST_ORG_A_ID)
    })
  })

  describe('Data Consistency Within Organization', () => {
    it('should maintain referential integrity within organization', async () => {
      // ARRANGE: Create patient and schedule in same organization
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Insert patient then schedule
      const { data: patient } = await supabase
        .from('patients')
        .insert({
          patient_name: '테스트',
          patient_id: 'REF-001',
        })
        .select()
        .single()

      const { data: schedule } = await supabase
        .from('schedules')
        .insert({
          patient_id: patient!.id,
          patient_name: '테스트',
          status: 'active',
        })
        .select()
        .single()

      // ASSERT: Both should have same organization_id
      expect(patient!.organization_id).toBe(TEST_ORG_A_ID)
      expect(schedule!.organization_id).toBe(TEST_ORG_A_ID)
      expect(schedule!.patient_id).toBe(patient!.id)
    })

    it('should prevent cross-organization references', async () => {
      // ARRANGE: User from Org A with patient from Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to create schedule referencing Org B patient
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          patient_id: '44444444-4444-4444-4444-444444444441', // Org B patient
          patient_name: '테스트투',
          status: 'active',
        })
        .select()
        .single()

      // ASSERT: Should either fail OR create with Org A's organization_id
      // Preferred: Fail with foreign key or RLS violation
      if (error) {
        expect(error.code).toMatch(/42501|23503/) // RLS or FK violation
      } else {
        // If allowed, must still be Org A's schedule
        expect(data!.organization_id).toBe(TEST_ORG_A_ID)
      }
    })
  })
})
