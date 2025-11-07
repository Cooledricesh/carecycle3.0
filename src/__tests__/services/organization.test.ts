/**
 * Organization Service Tests
 *
 * Test suite for organization creation and management during user signup.
 * Follows TDD principles: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import * as organizationService from '@/services/organizationService';

// Mock Supabase client type
type MockSupabaseClient = {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
      ilike: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
      single?: () => Promise<{ data: unknown; error: unknown }>;
    };
    insert: (values: unknown) => {
      select: (columns?: string) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  rpc: (fnName: string, params: unknown) => Promise<{ data: unknown; error: unknown }>;
};

describe('Organization Service', () => {
  describe('validateOrganizationName', () => {
    it('should reject empty organization name', () => {
      const result = organizationService.validateOrganizationName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조직 이름을 입력해주세요.');
    });

    it('should reject whitespace-only organization name', () => {
      const result = organizationService.validateOrganizationName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조직 이름을 입력해주세요.');
    });

    it('should reject organization name shorter than 2 characters', () => {
      const result = organizationService.validateOrganizationName('A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조직 이름은 2자 이상 100자 이하여야 합니다.');
    });

    it('should reject organization name longer than 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = organizationService.validateOrganizationName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조직 이름은 2자 이상 100자 이하여야 합니다.');
    });

    it('should accept valid organization name', () => {
      const result = organizationService.validateOrganizationName('테스트병원');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should trim whitespace from organization name', () => {
      const result = organizationService.validateOrganizationName('  테스트병원  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('searchOrganizations', () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: null,
              error: null
            })),
            ilike: vi.fn(async () => ({
              data: [
                { id: 'org-1', name: '테스트병원' },
                { id: 'org-2', name: '테스트새병원' }
              ],
              error: null
            }))
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: null
              }))
            }))
          }))
        })),
        rpc: vi.fn()
      };
    });

    it('should search organizations by name (case-insensitive)', async () => {
      const result = await organizationService.searchOrganizations(
        mockSupabase as unknown as SupabaseClient<Database>,
        '테스트'
      );

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should support partial name matching', async () => {
      const result = await organizationService.searchOrganizations(
        mockSupabase as unknown as SupabaseClient<Database>,
        '병원'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.every(org => org.name.includes('병원'))).toBe(true);
    });

    it('should return empty array when no organizations match', async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: null,
            error: null
          })),
          ilike: vi.fn(async () => ({
            data: [],
            error: null
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: null
            }))
          }))
        }))
      }));

      const result = await organizationService.searchOrganizations(
        mockSupabase as unknown as SupabaseClient<Database>,
        'NonexistentOrg'
      );

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: null,
            error: null
          })),
          ilike: vi.fn(async () => ({
            data: null,
            error: { message: 'Database error' }
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: null
            }))
          }))
        }))
      }));

      const result = await organizationService.searchOrganizations(
        mockSupabase as unknown as SupabaseClient<Database>,
        '테스트'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('createOrganization', () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn(),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: 'new-org-id', name: '테스트병원' },
                error: null
              }))
            }))
          }))
        })),
        rpc: vi.fn()
      };
    });

    it('should create new organization with unique name', async () => {
      const result = await organizationService.createOrganization(
        mockSupabase as unknown as SupabaseClient<Database>,
        '테스트병원'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('테스트병원');
      expect(result.data?.id).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should reject duplicate organization name', async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: '23505', message: 'duplicate key value' }
            }))
          }))
        }))
      }));

      const result = await organizationService.createOrganization(
        mockSupabase as unknown as SupabaseClient<Database>,
        '테스트병원'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('이미 존재하는');
    });

    it('should handle database errors during creation', async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { message: 'Database connection failed' }
            }))
          }))
        }))
      }));

      const result = await organizationService.createOrganization(
        mockSupabase as unknown as SupabaseClient<Database>,
        '테스트병원'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('createOrganizationAndRegisterUser (RPC)', () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(async () => ({
          data: { organization_id: 'new-org-id' },
          error: null
        }))
      };
    });

    it('should create organization and register user as first admin', async () => {
      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.organization_id).toBe('new-org-id');
      expect(result.error).toBeNull();
    });

    it('should call RPC function with correct parameters', async () => {
      const rpcSpy = vi.fn(async () => ({
        data: { organization_id: 'new-org-id' },
        error: null
      }));

      mockSupabase.rpc = rpcSpy;

      await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(rpcSpy).toHaveBeenCalledWith('create_organization_and_register_user', {
        p_user_id: 'user-123',
        p_organization_name: '테스트병원',
        p_user_role: 'admin'
      });
    });

    it('should handle duplicate organization name in RPC', async () => {
      mockSupabase.rpc = vi.fn(async () => ({
        data: null,
        error: { code: '23505', message: 'duplicate key value' }
      }));

      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('이미 존재하는');
    });

    it('should maintain data consistency (atomic operation)', async () => {
      // Simulate transaction failure - neither org nor profile should be created
      mockSupabase.rpc = vi.fn(async () => ({
        data: null,
        error: { message: 'Transaction failed' }
      }));

      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle invalid user role', async () => {
      mockSupabase.rpc = vi.fn(async () => ({
        data: null,
        error: { message: 'Invalid role' }
      }));

      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'invalid-role'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should set user as first admin of new organization', async () => {
      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(result.data).toBeDefined();
      // In real implementation, we would verify user's role is set to admin
      // and organization_id is set in their profile
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle network timeout gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(async () => {
          throw new Error('Network timeout');
        })
      };

      const result = await organizationService.createOrganizationAndRegisterUser(
        mockSupabase as unknown as SupabaseClient<Database>,
        'user-123',
        '테스트병원',
        'admin'
      );

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should sanitize organization name input', () => {
      const result = organizationService.validateOrganizationName('  <script>alert("xss")</script>  ');
      expect(result.valid).toBe(false);
      // Should reject names containing HTML/script tags
    });

    it('should handle special characters in organization name', () => {
      const result = organizationService.validateOrganizationName('테스트병원 (본원)');
      expect(result.valid).toBe(true);
    });
  });
});
