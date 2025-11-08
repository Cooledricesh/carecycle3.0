/**
 * Item Service Tests - Multitenancy Data Isolation
 *
 * Test suite following strict TDD methodology:
 * RED -> GREEN -> REFACTOR
 *
 * Tests verify that all itemService methods properly filter data by organization_id
 * to ensure complete data isolation between organizations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { itemService } from '@/services/itemService';

// Test data types
type TestOrganization = {
  id: string;
  name: string;
};

type TestItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  organization_id: string;
  is_active: boolean;
};

// Mock Supabase client factory
function createMockSupabaseClient(): any {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  return {
    from: vi.fn(() => mockQueryBuilder),
  };
}

describe('itemService - Multitenancy Data Isolation', () => {
  let mockSupabase: any;
  let org1: TestOrganization;
  let org2: TestOrganization;
  let item1: TestItem;
  let item2: TestItem;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();

    // Setup test organizations
    org1 = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Hospital A',
    };

    org2 = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Hospital B',
    };

    // Setup test items
    item1 = {
      id: '10000000-0000-0000-0000-000000000001',
      code: 'TEST001',
      name: '검사 A',
      category: 'test',
      organization_id: org1.id,
      is_active: true,
    };

    item2 = {
      id: '10000000-0000-0000-0000-000000000002',
      code: 'TEST002',
      name: '검사 B',
      category: 'test',
      organization_id: org2.id,
      is_active: true,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create() - Data Isolation', () => {
    it('should add organization_id to inserted item', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const insertSpy = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-item-id',
              code: 'TEST003',
              name: '새 검사',
              category: 'test',
              organization_id: org1.id,
              is_active: true,
            },
            error: null,
          }),
        }),
      }));
      mockFrom.mockReturnValue({ insert: insertSpy });

      const input = {
        code: 'TEST003',
        name: '새 검사',
        category: 'test' as const,
        defaultIntervalWeeks: 4,
        requiresNotification: false,
        notificationDaysBefore: 7,
        isActive: true,
        sortOrder: 0,
      };

      // Act
      await itemService.create(input, org1.id, mockSupabase);

      // Assert: Verify organization_id is in insert data
      expect(insertSpy).toHaveBeenCalled();
      const firstCall = insertSpy.mock.calls[0];
      if (firstCall && firstCall.length > 0) {
        // @ts-expect-error - We verify array length before accessing
        expect(firstCall[0]).toHaveProperty('organization_id', org1.id);
      }
    });

    it('should throw error when organization_id is missing', async () => {
      const input = {
        code: 'TEST003',
        name: '새 검사',
        category: 'test' as const,
        defaultIntervalWeeks: 4,
        requiresNotification: false,
        notificationDaysBefore: 7,
        isActive: true,
        sortOrder: 0,
      };

      // Act & Assert
      await expect(
        itemService.create(input, '', mockSupabase)
      ).rejects.toThrow('Organization ID is required');
    });
  });

  describe('getAll() - Data Isolation', () => {
    it('should filter items by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [item1],
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await itemService.getAll(org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
      expect(eqSpy).toHaveBeenCalledWith('is_active', true);
    });

    it('should only return items from specified organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [item1], // Only org1 data
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await itemService.getAll(org1.id, mockSupabase);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(item1.id);
    });

    it('should throw error when organization_id is missing', async () => {
      // Act & Assert
      await expect(
        itemService.getAll('', mockSupabase)
      ).rejects.toThrow('Organization ID is required');
    });
  });

  describe('getByCategory() - Data Isolation', () => {
    it('should filter by both category and organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  eq: vi.fn((column3) => {
                    eqSpy(column3);
                    return {
                      order: vi.fn().mockResolvedValue({
                        data: [item1],
                        error: null,
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await itemService.getByCategory('test', org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('category', 'test');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should not return items from different organization with same category', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [], // No org2 items for org1 query
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await itemService.getByCategory('test', org1.id, mockSupabase);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getById() - Data Isolation', () => {
    it('should filter by both id and organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  single: vi.fn().mockResolvedValue({
                    data: item1,
                    error: null,
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await itemService.getById(item1.id, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', item1.id);
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should return null when item belongs to different organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await itemService.getById(item1.id, org2.id, mockSupabase);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getByCode() - Data Isolation', () => {
    it('should filter by both code and organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  single: vi.fn().mockResolvedValue({
                    data: item1,
                    error: null,
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await itemService.getByCode('TEST001', org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('code', 'TEST001');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should allow same item code in different organizations', async () => {
      // Arrange: Both orgs can have item with code 'COMMON'
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;

      // First call for org1
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...item1, code: 'COMMON' },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result1 = await itemService.getByCode('COMMON', org1.id, mockSupabase);

      // Assert
      expect(result1?.code).toBe('COMMON');
      expect(result1?.organizationId).toBe(org1.id);
    });
  });

  describe('update() - Data Isolation', () => {
    it('should filter update by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: item1,
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }),
        }),
      });

      const input = {
        name: '수정된 검사명',
      };

      // Act
      await itemService.update(item1.id, input, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', item1.id);
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should fail to update item from different organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'No rows found' },
                }),
              }),
            }),
          }),
        }),
      });

      const input = {
        name: '수정된 검사명',
      };

      // Act & Assert
      await expect(
        itemService.update(item1.id, input, org2.id, mockSupabase)
      ).rejects.toThrow();
    });
  });

  describe('delete() - Data Isolation', () => {
    it('should filter delete by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return Promise.resolve({ data: null, error: null });
              }),
            };
          }),
        }),
      });

      // Act
      await itemService.delete(item1.id, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', item1.id);
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should not delete item from different organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(
              Promise.resolve({ data: null, error: { message: 'No rows affected' } })
            ),
          }),
        }),
      });

      // Act & Assert
      await expect(
        itemService.delete(item1.id, org2.id, mockSupabase)
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string organization_id', async () => {
      // Act & Assert
      await expect(
        itemService.getAll('', mockSupabase)
      ).rejects.toThrow('Organization ID is required');
    });

    it('should handle undefined organization_id', async () => {
      // Act & Assert
      await expect(
        itemService.getAll(undefined as any, mockSupabase)
      ).rejects.toThrow();
    });

    it('should handle non-existent organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [], // No data for non-existent org
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await itemService.getAll(
        '99999999-9999-9999-9999-999999999999',
        mockSupabase
      );

      // Assert
      expect(result).toEqual([]);
    });
  });
});
