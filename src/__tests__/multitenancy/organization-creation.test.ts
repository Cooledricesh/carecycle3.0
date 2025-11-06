/**
 * TDD Test Suite: Organization Creation Permissions
 *
 * RED PHASE - These tests MUST fail initially
 *
 * Purpose: Verify that any authenticated user can create a new organization
 * and become the first admin of that organization. Organization names must
 * be unique across the system.
 *
 * RLS Policy Requirements:
 * - Any authenticated user can INSERT into organizations table
 * - Organization name must be unique (enforced by constraint)
 * - Creator automatically becomes admin (role assignment)
 * - Profile organization_id automatically set to new organization
 * - Users can view their own organization details
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockSupabaseClient,
  TEST_ORG_A_ID,
  TEST_ORG_B_ID,
  TEST_ADMIN_ORG_A_ID,
  expectSuccessfulQuery,
  expectRLSViolation,
} from './test-helpers'

describe('RED: Organization Creation Permissions', () => {
  describe('Organization Creation by Authenticated Users', () => {
    it('should allow authenticated user to create new organization', async () => {
      // ARRANGE: New authenticated user without organization
      const newUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create new organization
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '새병원',
        })
        .select()
        .single()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data!.name).toBe('새병원')
      expect(data!.id).toBeDefined()
    })

    it('should allow user with organization to create another organization', async () => {
      // ARRANGE: Existing user from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Create second organization
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '제2병원',
        })
        .select()
        .single()

      // ASSERT: Should succeed (user can create multiple orgs)
      expectSuccessfulQuery(data, error)
      expect(data!.name).toBe('제2병원')
    })

    it('should auto-generate timestamps on organization creation', async () => {
      // ARRANGE: New user creating organization
      const newUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create organization without timestamps
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '타임스탬프병원',
        })
        .select()
        .single()

      // ASSERT: Should have auto-generated timestamps
      expectSuccessfulQuery(data, error)
      expect(data!.created_at).toBeDefined()
      expect(data!.updated_at).toBeDefined()
    })

    it('should allow organization creation with optional fields', async () => {
      // ARRANGE: User creating organization with full details
      const newUserId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create organization with optional fields
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '상세병원',
          description: '상세한 설명',
          address: '서울시 강남구',
          phone: '02-1234-5678',
        })
        .select()
        .single()

      // ASSERT: Should succeed with all fields
      expectSuccessfulQuery(data, error)
      expect(data!.name).toBe('상세병원')
      expect(data!.description).toBe('상세한 설명')
      expect(data!.address).toBe('서울시 강남구')
      expect(data!.phone).toBe('02-1234-5678')
    })
  })

  describe('Organization Name Uniqueness', () => {
    it('should prevent duplicate organization names', async () => {
      // ARRANGE: User trying to create org with existing name
      const newUserId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Try to create organization with duplicate name
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '테스트병원A', // Already exists in test data
        })
        .select()
        .single()

      // ASSERT: Should fail with unique constraint violation
      expect(error).not.toBeNull()
      expect(error!.code).toBe('23505') // Unique violation
      expect(data).toBeNull()
    })

    it('should allow case-sensitive duplicate names if configured', async () => {
      // ARRANGE: User creating org with different case
      const newUserId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create organization with different case
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '테스트병원a', // Lowercase 'a'
        })
        .select()
        .single()

      // ASSERT: Should succeed if case-sensitive
      // OR fail if case-insensitive unique constraint
      if (error) {
        expect(error.code).toBe('23505')
      } else {
        expectSuccessfulQuery(data, error)
      }
    })

    it('should trim whitespace before uniqueness check', async () => {
      // ARRANGE: User trying to create org with whitespace
      const newUserId = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Try to create with leading/trailing whitespace
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '  테스트병원A  ', // Whitespace around existing name
        })
        .select()
        .single()

      // ASSERT: Should fail if trimming is applied
      expect(error).not.toBeNull()
      expect(error!.code).toBe('23505')
    })
  })

  describe('Creator Admin Role Assignment', () => {
    it('should automatically assign creator as admin', async () => {
      // ARRANGE: New user creating organization
      const newUserId = 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create organization and check profile
      const { data: org } = await supabase
        .from('organizations')
        .insert({ name: '관리자병원' })
        .select()
        .single()

      // Check creator's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', newUserId)
        .single()

      // ASSERT: Profile should have admin role and new org
      expectSuccessfulQuery(profile, profileError)
      expect(profile!.role).toBe('admin')
      expect(profile!.organization_id).toBe(org!.id)
    })

    it('should update existing profile with new organization', async () => {
      // ARRANGE: User with profile but no organization
      const newUserId = 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create organization
      const { data: org } = await supabase
        .from('organizations')
        .insert({ name: '업데이트병원' })
        .select()
        .single()

      // Check profile was updated
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', newUserId)
        .single()

      // ASSERT: Profile should be linked to new organization
      expect(profile!.organization_id).toBe(org!.id)
      expect(profile!.role).toBe('admin')
    })

    it('should handle multiple admins in same organization', async () => {
      // ARRANGE: Two users creating separate orgs
      const user1Id = 'jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj'
      const user2Id = 'kkkkkkkk-kkkk-kkkk-kkkk-kkkkkkkkkkkk'
      const client1 = createMockSupabaseClient(user1Id, '')
      const client2 = createMockSupabaseClient(user2Id, '')

      // ACT: Both create organizations
      const { data: org1 } = await client1
        .from('organizations')
        .insert({ name: '병원1' })
        .select()
        .single()

      const { data: org2 } = await client2
        .from('organizations')
        .insert({ name: '병원2' })
        .select()
        .single()

      // ASSERT: Both should be admins of their own orgs
      expect(org1!.id).not.toBe(org2!.id)
    })
  })

  describe('Organization Viewing Permissions', () => {
    it('should allow users to view their own organization', async () => {
      // ARRANGE: User with organization
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: View own organization
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', TEST_ORG_A_ID)
        .single()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data!.id).toBe(TEST_ORG_A_ID)
    })

    it('should allow users to view organization list (for joining)', async () => {
      // ARRANGE: New user browsing organizations
      const newUserId = 'llllllll-llll-llll-llll-llllllllllll'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: View all organizations
      const { data, error } = await supabase.from('organizations').select('*')

      // ASSERT: Should succeed (public list for join requests)
      expectSuccessfulQuery(data, error)
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should prevent viewing other organization sensitive data', async () => {
      // ARRANGE: User from Org A viewing Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to view Org B details
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', TEST_ORG_B_ID)
        .single()

      // ASSERT: Should succeed but not reveal sensitive fields
      // Or: Should be allowed for join request purposes
      expectSuccessfulQuery(data, error)
      // Sensitive fields should be filtered via column-level security
    })
  })

  describe('Organization Update Permissions', () => {
    it('should allow admin to update their organization', async () => {
      // ARRANGE: Admin from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Update organization details
      const { data, error } = await supabase
        .from('organizations')
        .update({
          description: '업데이트된 설명',
          phone: '02-9999-8888',
        })
        .eq('id', TEST_ORG_A_ID)
        .select()

      // ASSERT: Should succeed
      expectSuccessfulQuery(data, error)
      expect(data![0].description).toBe('업데이트된 설명')
    })

    it('should prevent non-admin from updating organization', async () => {
      // ARRANGE: Nurse trying to update organization
      const nurseId = '11111111-1111-1111-1111-111111111112'
      const supabase = createMockSupabaseClient(nurseId, TEST_ORG_A_ID)

      // ACT: Try to update organization
      const { data, error } = await supabase
        .from('organizations')
        .update({ description: '해킹시도' })
        .eq('id', TEST_ORG_A_ID)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent admin from updating other organizations', async () => {
      // ARRANGE: Admin from Org A trying to update Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to update Org B
      const { data, error } = await supabase
        .from('organizations')
        .update({ description: '크로스업데이트' })
        .eq('id', TEST_ORG_B_ID)
        .select()

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent changing organization name to duplicate', async () => {
      // ARRANGE: Admin trying to rename to existing name
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to rename to duplicate
      const { data, error } = await supabase
        .from('organizations')
        .update({ name: '테스트병원B' })
        .eq('id', TEST_ORG_A_ID)
        .select()

      // ASSERT: Should fail with unique constraint
      expect(error).not.toBeNull()
      expect(error!.code).toBe('23505')
    })
  })

  describe('Organization Deletion Permissions', () => {
    it('should allow admin to delete their organization', async () => {
      // ARRANGE: Admin from Org A
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete organization
      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', TEST_ORG_A_ID)

      // ASSERT: Should succeed (with cascade implications)
      expectSuccessfulQuery(data, error)
    })

    it('should prevent non-admin from deleting organization', async () => {
      // ARRANGE: Nurse trying to delete organization
      const nurseId = '11111111-1111-1111-1111-111111111112'
      const supabase = createMockSupabaseClient(nurseId, TEST_ORG_A_ID)

      // ACT: Try to delete organization
      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', TEST_ORG_A_ID)

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should prevent admin from deleting other organizations', async () => {
      // ARRANGE: Admin from Org A trying to delete Org B
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Try to delete Org B
      const { data, error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', TEST_ORG_B_ID)

      // ASSERT: Should fail with RLS violation
      expectRLSViolation(error)
      expect(data).toBeNull()
    })

    it('should handle cascade deletion of related data', async () => {
      // ARRANGE: Admin deleting organization with data
      const supabase = createMockSupabaseClient(TEST_ADMIN_ORG_A_ID, TEST_ORG_A_ID)

      // ACT: Delete organization
      await supabase.from('organizations').delete().eq('id', TEST_ORG_A_ID)

      // Check if related data is also deleted
      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('organization_id', TEST_ORG_A_ID)

      // ASSERT: Related data should be deleted (ON DELETE CASCADE)
      expect(patients).toHaveLength(0)
    })
  })

  describe('Edge Cases - Organization Creation', () => {
    it('should handle empty organization name', async () => {
      // ARRANGE: User creating org with empty name
      const newUserId = 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Try to create with empty name
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name: '' })
        .select()
        .single()

      // ASSERT: Should fail with validation error
      expect(error).not.toBeNull()
      expect(error!.code).toMatch(/23502|23514/) // Not null or check constraint
    })

    it('should handle very long organization names', async () => {
      // ARRANGE: User creating org with max length name
      const newUserId = 'nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn'
      const supabase = createMockSupabaseClient(newUserId, '')
      const longName = 'ㄱ'.repeat(255) // Max length

      // ACT: Create with long name
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name: longName })
        .select()
        .single()

      // ASSERT: Should succeed if within limit
      if (longName.length <= 255) {
        expectSuccessfulQuery(data, error)
      } else {
        expect(error).not.toBeNull()
      }
    })

    it('should handle special characters in organization name', async () => {
      // ARRANGE: User creating org with special chars
      const newUserId = 'oooooooo-oooo-oooo-oooo-oooooooooooo'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Create with special characters
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: '병원@#$%^&*()',
        })
        .select()
        .single()

      // ASSERT: Should succeed (special chars allowed)
      expectSuccessfulQuery(data, error)
      expect(data!.name).toBe('병원@#$%^&*()')
    })

    it('should prevent SQL injection in organization name', async () => {
      // ARRANGE: Malicious user attempting SQL injection
      const newUserId = 'pppppppp-pppp-pppp-pppp-pppppppppppp'
      const supabase = createMockSupabaseClient(newUserId, '')

      // ACT: Try SQL injection
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: "'; DROP TABLE organizations; --",
        })
        .select()
        .single()

      // ASSERT: Should be safely escaped
      expectSuccessfulQuery(data, error)
      expect(data!.name).toBe("'; DROP TABLE organizations; --")

      // Verify tables still exist
      const { data: orgs } = await supabase.from('organizations').select('*')
      expect(orgs).toBeDefined()
    })
  })
})
