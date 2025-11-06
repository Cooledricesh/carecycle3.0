/**
 * Organization RPC Function Tests
 *
 * Test suite for create_organization_and_register_user RPC function.
 * This tests the database-level transaction logic.
 * Follows TDD principles: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

describe('create_organization_and_register_user RPC Function', () => {
  let supabase: SupabaseClient<Database>;
  const testUserId = 'test-user-' + Date.now();
  const testOrgName = '테스트병원' + Date.now();

  beforeEach(async () => {
    supabase = await createServiceClient();
  });

  afterEach(async () => {
    // Cleanup test data
    if (supabase) {
      await supabase
        .from('profiles')
        .delete()
        .eq('id', testUserId);

      await supabase
        .from('organizations')
        .delete()
        .eq('name', testOrgName);
    }
  });

  describe('Successful Organization Creation', () => {
    it('should create new organization', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.organization_id).toBeDefined();
    });

    it('should return organization_id', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();
      expect(typeof data.organization_id).toBe('string');
      expect(data.organization_id.length).toBeGreaterThan(0);
    });

    it('should create organization with correct name', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      // Verify organization was created
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', data.organization_id)
        .single();

      expect(orgError).toBeNull();
      expect(org?.name).toBe(testOrgName);
    });

    it('should set created_at and updated_at timestamps', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', data.organization_id)
        .single();

      expect(org?.created_at).toBeDefined();
      expect(org?.updated_at).toBeDefined();
      expect(new Date(org!.created_at)).toBeInstanceOf(Date);
    });
  });

  describe('User Registration as First Admin', () => {
    it('should update user profile with organization_id', async () => {
      // First create the user profile
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      // Verify profile was updated
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      expect(profile?.organization_id).toBe(data.organization_id);
    });

    it('should set user role to admin', async () => {
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      expect(profile?.role).toBe('admin');
    });

    it('should mark user as first admin of organization', async () => {
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      // Check organization has the user as first admin
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', data.organization_id)
        .single();

      expect(org?.created_by).toBe(testUserId);
    });
  });

  describe('Transaction Atomicity', () => {
    it('should rollback if organization creation fails', async () => {
      // Attempt to create with duplicate name
      const firstCall = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(firstCall.error).toBeNull();

      const secondCall = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: 'another-user-id',
        p_organization_name: testOrgName, // Duplicate name
        p_user_role: 'admin'
      });

      expect(secondCall.error).toBeDefined();

      // Verify user profile was not updated
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', 'another-user-id')
        .single();

      expect(profile).toBeNull();
    });

    it('should rollback if profile update fails', async () => {
      // Try with non-existent user
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: 'non-existent-user',
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();

      // Verify organization was not created
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('name', testOrgName)
        .single();

      expect(org).toBeNull();
    });

    it('should maintain data consistency on partial failure', async () => {
      // Simulate a scenario where transaction should fail midway
      const { error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: '', // Invalid user ID
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();

      // Verify no orphaned organization
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .eq('name', testOrgName);

      expect(orgs).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should reject duplicate organization name', async () => {
      // Create first organization
      await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      // Try to create with same name
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: 'another-user',
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe('23505'); // Unique violation
      expect(data).toBeNull();
    });

    it('should reject empty organization name', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: '',
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should reject whitespace-only organization name', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: '   ',
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should reject invalid user role', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'invalid-role'
      });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should handle null user_id gracefully', async () => {
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: null as any,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should handle database constraint violations', async () => {
      // Test organization name length constraint
      const longName = 'A'.repeat(101);
      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: longName,
        p_user_role: 'admin'
      });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in organization name', async () => {
      const specialName = '테스트병원 (본원) - 2025';

      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: specialName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();
      expect(data.organization_id).toBeDefined();

      // Cleanup
      await supabase
        .from('organizations')
        .delete()
        .eq('name', specialName);
    });

    it('should trim organization name before saving', async () => {
      const nameWithSpaces = '  테스트병원  ';
      const trimmedName = nameWithSpaces.trim();

      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: nameWithSpaces,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', data.organization_id)
        .single();

      expect(org?.name).toBe(trimmedName);

      // Cleanup
      await supabase
        .from('organizations')
        .delete()
        .eq('name', trimmedName);
    });

    it('should handle concurrent organization creation attempts', async () => {
      // Simulate two users trying to create same organization simultaneously
      const promises = [
        supabase.rpc('create_organization_and_register_user', {
          p_user_id: 'user-1',
          p_organization_name: '동시생성병원',
          p_user_role: 'admin'
        }),
        supabase.rpc('create_organization_and_register_user', {
          p_user_id: 'user-2',
          p_organization_name: '동시생성병원',
          p_user_role: 'admin'
        })
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled' && !r.value.error);
      const failures = results.filter(r => r.status === 'fulfilled' && r.value.error);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Cleanup
      await supabase
        .from('organizations')
        .delete()
        .eq('name', '동시생성병원');
    });
  });

  describe('Performance', () => {
    it('should complete within acceptable time (< 1000ms)', async () => {
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const startTime = Date.now();

      await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Return Value Schema', () => {
    it('should return correct data structure', async () => {
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        organization_id: expect.any(String)
      });
    });

    it('should return UUID format organization_id', async () => {
      await supabase.from('profiles').insert({
        id: testUserId,
        email: 'test@example.com',
        name: '테스트유저',
        role: 'nurse'
      });

      const { data, error } = await supabase.rpc('create_organization_and_register_user', {
        p_user_id: testUserId,
        p_organization_name: testOrgName,
        p_user_role: 'admin'
      });

      expect(error).toBeNull();

      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(data.organization_id).toMatch(uuidRegex);
    });
  });
});
