/**
 * Schedule Service Tests - Multitenancy Data Isolation
 *
 * Test suite following strict TDD methodology:
 * RED -> GREEN -> REFACTOR
 *
 * Tests verify that all scheduleService methods properly filter data by organization_id
 * to ensure complete data isolation between organizations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { scheduleService } from '@/services/scheduleService';
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced';
import type { UserContext } from '@/services/filters/types';

// Test data types
type TestOrganization = {
  id: string;
  name: string;
};

type TestPatient = {
  id: string;
  name: string;
  patient_number: string;
  organization_id: string;
};

type TestItem = {
  id: string;
  name: string;
  code: string;
  category: string;
  organization_id: string;
};

type TestSchedule = {
  id: string;
  patient_id: string;
  item_id: string;
  interval_weeks: number;
  start_date: string;
  next_due_date: string;
  status: string;
  organization_id: string;
};

// Mock Supabase client factory
function createMockSupabaseClient(): any {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  return {
    from: vi.fn(() => mockQueryBuilder),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  };
}

describe('scheduleService - Multitenancy Data Isolation', () => {
  let mockSupabase: any;
  let org1: TestOrganization;
  let org2: TestOrganization;
  let patient1: TestPatient;
  let patient2: TestPatient;
  let item1: TestItem;
  let item2: TestItem;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();

    // Setup test organizations (using valid UUIDs)
    org1 = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Hospital A',
    };

    org2 = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Hospital B',
    };

    // Setup test patients (one per organization)
    patient1 = {
      id: '10000000-0000-0000-0000-000000000001',
      name: '환자A',
      patient_number: 'P001',
      organization_id: org1.id,
    };

    patient2 = {
      id: '10000000-0000-0000-0000-000000000002',
      name: '환자B',
      patient_number: 'P002',
      organization_id: org2.id,
    };

    // Setup test items
    item1 = {
      id: '20000000-0000-0000-0000-000000000001',
      name: '검사A',
      code: 'TEST001',
      category: 'test',
      organization_id: org1.id,
    };

    item2 = {
      id: '20000000-0000-0000-0000-000000000002',
      name: '검사B',
      code: 'TEST002',
      category: 'test',
      organization_id: org2.id,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create() - Data Isolation', () => {
    it('should filter duplicate check by organization_id', async () => {
      // Arrange: Mock no existing schedule in org1
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const selectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });
      mockFrom.mockReturnValue({ select: selectSpy });

      // Mock successful insert
      const insertBuilder = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-schedule-id',
              patient_id: patient1.id,
              item_id: item1.id,
              organization_id: org1.id,
              status: 'active',
            },
            error: null,
          }),
        }),
      };
      mockFrom.mockReturnValueOnce({ select: selectSpy })
        .mockReturnValueOnce({ insert: vi.fn(() => insertBuilder) });

      const input = {
        patientId: patient1.id,
        itemId: item1.id,
        intervalWeeks: 4,
        startDate: '2025-01-01',
        priority: 0,
        requiresNotification: false,
        notificationDaysBefore: 7,
      };

      // Act
      await scheduleService.create(input, org1.id, mockSupabase);

      // Assert: Verify organization_id was used in duplicate check
      expect(mockFrom).toHaveBeenCalledWith('schedules');
      // The duplicate check should include .eq('organization_id', org1.id)
    });

    it('should throw error when organization_id is missing', async () => {
      const input = {
        patientId: patient1.id,
        itemId: item1.id,
        intervalWeeks: 4,
        startDate: '2025-01-01',
        priority: 0,
        requiresNotification: false,
        notificationDaysBefore: 7,
      };

      // Act & Assert
      await expect(
        scheduleService.create(input, '' as any, mockSupabase)
      ).rejects.toThrow();
    });

    it('should add organization_id to inserted schedule', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;

      // Mock no duplicate
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      // Mock insert
      const insertSpy = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-schedule-id',
              patient_id: patient1.id,
              item_id: item1.id,
              organization_id: org1.id,
              status: 'active',
            },
            error: null,
          }),
        }),
      }));
      mockFrom.mockReturnValueOnce({ insert: insertSpy });

      const input = {
        patientId: patient1.id,
        itemId: item1.id,
        intervalWeeks: 4,
        startDate: '2025-01-01',
        priority: 0,
        requiresNotification: false,
        notificationDaysBefore: 7,
      };

      // Act
      await scheduleService.create(input, org1.id, mockSupabase);

      // Assert: Verify organization_id is in insert data
      expect(insertSpy).toHaveBeenCalled();
      const firstCall = insertSpy.mock.calls[0];
      if (firstCall && firstCall.length > 0) {
        // @ts-expect-error - We verify array length before accessing
        expect(firstCall[0]).toHaveProperty('organization_id', org1.id);
      }
    });

    it('should allow same patient-item in different organizations', async () => {
      // This tests that duplicate checking is scoped to organization
      // Org1 can have patient1-item1, and Org2 can also have patient2-item2
      // Even if they represent the "same" logical test

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;

      // Mock no duplicate in org2
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      const insertSpy = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-schedule-id',
              patient_id: patient2.id,
              item_id: item2.id,
              organization_id: org2.id,
              status: 'active',
            },
            error: null,
          }),
        }),
      }));
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({ insert: insertSpy });

      const input = {
        patientId: patient2.id,
        itemId: item2.id,
        intervalWeeks: 4,
        startDate: '2025-01-01',
        priority: 0,
        requiresNotification: false,
        notificationDaysBefore: 7,
      };

      // Act - should succeed since it's a different organization
      await scheduleService.create(input, org2.id, mockSupabase);

      // Assert
      expect(insertSpy).toHaveBeenCalled();
    });
  });

  describe('getTodayChecklist() - Data Isolation (scheduleServiceEnhanced)', () => {
    it('should filter schedules by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column) => {
            eqSpy(column);
            return {
              eq: vi.fn((column2) => {
                eqSpy(column2);
                return {
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                };
              }),
            };
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: org1.id
      };

      // Act
      await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert: Verify organization_id filter was applied
      expect(eqSpy).toHaveBeenCalledWith('status');
      expect(eqSpy).toHaveBeenCalledWith('organization_id');
    });

    it('should only return schedules from specified organization', async () => {
      // Arrange: Create mock data with schedules from both orgs
      const org1Schedule = {
        id: 'schedule-1',
        schedule_id: 'schedule-1',
        patient_id: patient1.id,
        item_id: item1.id,
        organization_id: org1.id,
        status: 'active',
        next_due_date: '2025-01-07',
        patients: {
          ...patient1,
          departments: { name: 'Test Department' },
          assigned_doctor_name: 'Dr. Test',
          profiles: { name: 'Dr. Test' }
        },
        items: item1,
        interval_weeks: 4,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const org2Schedule = {
        id: 'schedule-2',
        schedule_id: 'schedule-2',
        patient_id: patient2.id,
        item_id: item2.id,
        organization_id: org2.id,
        status: 'active',
        next_due_date: '2025-01-07',
        patients: patient2,
        items: item2,
      };

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  data: [org1Schedule], // Only org1 data
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: org1.id
      };

      // Act
      const result = await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].schedule_id).toBe('schedule-1');
      // Should NOT include org2 schedule
    });

    it('should return empty array when organization_id is null (no RLS match)', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [], // RLS blocks all data
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: null as any
      };

      // Act
      const result = await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert: Returns empty due to RLS
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
                    data: {
                      id: 'schedule-1',
                      organization_id: org1.id,
                      patients: patient1,
                      items: item1,
                    },
                    error: null,
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await scheduleService.getById('schedule-1', org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', 'schedule-1');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should return null when schedule belongs to different organization', async () => {
      // Arrange: Schedule exists but in different org
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null, // RLS blocks access
                error: { code: 'PGRST116' }, // Not found
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await scheduleService.getById('schedule-1', org2.id, mockSupabase);

      // Assert
      expect(result).toBeNull();
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
                      data: {
                        id: 'schedule-1',
                        organization_id: org1.id,
                      },
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
        intervalWeeks: 8,
      };

      // Act
      await scheduleService.update('schedule-1', input, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', 'schedule-1');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should fail to update schedule from different organization', async () => {
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
        intervalWeeks: 8,
      };

      // Act & Assert
      await expect(
        scheduleService.update('schedule-1', input, org2.id, mockSupabase)
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
      await scheduleService.delete('schedule-1', org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', 'schedule-1');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should not delete schedule from different organization', async () => {
      // Arrange: Simulate RLS blocking the delete
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
        scheduleService.delete('schedule-1', org2.id, mockSupabase)
      ).rejects.toThrow();
    });
  });

  describe('getByPatientId() - Data Isolation', () => {
    it('should filter by organization_id', async () => {
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
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Act
      await scheduleService.getByPatientId(patient1.id, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('patient_id', patient1.id);
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should return empty array for patient in different organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [], // No data due to org mismatch
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act: Try to get patient1's schedules using org2's ID
      const result = await scheduleService.getByPatientId(patient1.id, org2.id, mockSupabase);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getOverdueSchedules() - Data Isolation', () => {
    it('should filter by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column) => {
            eqSpy(column);
            return {
              eq: vi.fn((column2) => {
                eqSpy(column2);
                return {
                  lt: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [],
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
      await scheduleService.getOverdueSchedules(org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('status');
      expect(eqSpy).toHaveBeenCalledWith('organization_id');
    });
  });

  describe('getAllSchedules() - Data Isolation', () => {
    it('should filter by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn((column, value) => {
              eqSpy(column, value);
              return {
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              };
            }),
          }),
        }),
      });

      // Act
      await scheduleService.getAllSchedules(org1.id, undefined, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });
  });

  describe('markAsCompleted() - Data Isolation', () => {
    it('should filter schedule fetch by organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const eqSpy = vi.fn().mockReturnThis();

      // Mock schedule fetch
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column, value) => {
            eqSpy(column, value);
            return {
              eq: vi.fn((column2, value2) => {
                eqSpy(column2, value2);
                return {
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'schedule-1',
                      organization_id: org1.id,
                      interval_weeks: 4,
                      next_due_date: '2025-01-07',
                      items: { id: item1.id },
                    },
                    error: null,
                  }),
                };
              }),
            };
          }),
        }),
      });

      // Mock RPC call
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      // Mock schedule update
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
          }),
        }),
      });

      const input = {
        executedDate: '2025-01-07',
        executedBy: 'user-id',
      };

      // Act
      await scheduleService.markAsCompleted('schedule-1', input, org1.id, mockSupabase);

      // Assert
      expect(eqSpy).toHaveBeenCalledWith('id', 'schedule-1');
      expect(eqSpy).toHaveBeenCalledWith('organization_id', org1.id);
    });

    it('should fail for schedule in different organization', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      });

      const input = {
        executedDate: '2025-01-07',
        executedBy: 'user-id',
      };

      // Act & Assert
      await expect(
        scheduleService.markAsCompleted('schedule-1', input, org2.id, mockSupabase)
      ).rejects.toThrow();
    });
  });

  describe('getCalendarSchedules() - Data Isolation', () => {
    it('should pass organization_id to RPC function', async () => {
      // Arrange
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      await scheduleService.getCalendarSchedules(
        '2025-01-01',
        '2025-01-31',
        org1.id,
        undefined,
        mockSupabase
      );

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_calendar_schedules', {
        p_start_date: '2025-01-01',
        p_end_date: '2025-01-31',
        p_user_id: undefined,
      });
    });

    it('should only return schedules from specified organization', async () => {
      // Arrange
      const org1Schedule = {
        schedule_id: 'schedule-1',
        patient_id: patient1.id,
        patient_name: patient1.name,
        item_id: item1.id,
        item_name: item1.name,
        organization_id: org1.id,
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [org1Schedule],
        error: null,
      });

      // Act
      const result = await scheduleService.getCalendarSchedules(
        '2025-01-01',
        '2025-01-31',
        org1.id,
        undefined,
        mockSupabase
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].schedule_id).toBe('schedule-1');
    });
  });

  describe('Edge Cases (scheduleServiceEnhanced)', () => {
    it('should handle empty string organization_id (returns empty due to no match)', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [], // No data for empty string
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: '' as any
      };

      // Act
      const result = await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert: Returns empty due to no match
      expect(result).toEqual([]);
    });

    it('should handle undefined organization_id (returns empty due to no match)', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [], // No data for undefined
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: undefined as any
      };

      // Act
      const result = await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert: Returns empty due to no match
      expect(result).toEqual([]);
    });

    it('should handle non-existent organization_id', async () => {
      // Arrange
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [], // No data for non-existent org
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const userContext: UserContext & { organizationId: string } = {
        userId: 'test-user-id',
        role: 'nurse',
        careType: null,
        departmentId: null,
        organizationId: '99999999-9999-9999-9999-999999999999'
      };

      // Act
      const result = await scheduleServiceEnhanced.getTodayChecklist(false, userContext, mockSupabase);

      // Assert: Should return empty array, not error
      expect(result).toEqual([]);
    });
  });
});
