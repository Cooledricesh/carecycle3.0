'use client'

/**
 * Centralized Query Key Factory
 * Ensures consistent query key structure across the application
 * Enables proper cache invalidation and query dependencies
 */

export const queryKeys = {
  // Base keys
  all: ['all'] as const,
  
  // Schedules
  schedules: {
    all: ['schedules'] as const,
    lists: () => [...queryKeys.schedules.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.schedules.lists(), filters] as const,
    details: () => [...queryKeys.schedules.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.schedules.details(), id] as const,
    
    // Specific schedule queries
    today: () => [...queryKeys.schedules.all, 'today'] as const,
    upcoming: (days?: number) => [...queryKeys.schedules.all, 'upcoming', days] as const,
    overdue: () => [...queryKeys.schedules.all, 'overdue'] as const,
    byPatient: (patientId: string) => [...queryKeys.schedules.all, 'patient', patientId] as const,
  },
  
  // Patients
  patients: {
    all: ['patients'] as const,
    lists: () => [...queryKeys.patients.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.patients.lists(), filters] as const,
    details: () => [...queryKeys.patients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.patients.details(), id] as const,
    search: (query: string) => [...queryKeys.patients.all, 'search', query] as const,
  },
  
  // Executions
  executions: {
    all: ['executions'] as const,
    lists: () => [...queryKeys.executions.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.executions.lists(), filters] as const,
    bySchedule: (scheduleId: string) => [...queryKeys.executions.all, 'schedule', scheduleId] as const,
    byDate: (startDate: string, endDate: string) => 
      [...queryKeys.executions.all, 'date', startDate, endDate] as const,
    today: () => [...queryKeys.executions.all, 'today'] as const,
  },
  
  // Items
  items: {
    all: ['items'] as const,
    lists: () => [...queryKeys.items.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.items.lists(), filters] as const,
    byCategory: (category: string) => [...queryKeys.items.all, 'category', category] as const,
    detail: (id: string) => [...queryKeys.items.all, 'detail', id] as const,
  },
} as const;

/**
 * Helper function to invalidate all queries under a specific namespace
 * Usage: invalidateQueries(queryClient, queryKeys.schedules.all)
 */
export const getInvalidationKeys = (baseKey: readonly unknown[]) => {
  return { queryKey: baseKey };
};

/**
 * Get all schedule-related query keys for comprehensive invalidation
 */
export const getAllScheduleKeys = () => [
  queryKeys.schedules.all,
  queryKeys.executions.all,
  // Include patient schedules since they're related
  ...Object.values(queryKeys.patients).filter(key => 
    typeof key === 'function' ? false : true
  ),
];

/**
 * Get all patient-related query keys
 */
export const getAllPatientKeys = () => [
  queryKeys.patients.all,
  queryKeys.schedules.all, // Schedules are related to patients
];

/**
 * Smart invalidation helper
 * Invalidates related queries based on the mutation type
 */
export const getRelatedQueryKeys = (mutationType: string, entityId?: string) => {
  switch (mutationType) {
    case 'schedule.complete':
      return [
        queryKeys.schedules.all,
        queryKeys.executions.all,
        queryKeys.schedules.today(),
        queryKeys.schedules.upcoming(),
        queryKeys.schedules.overdue(),
      ];
    
    case 'schedule.create':
    case 'schedule.update':
    case 'schedule.delete':
      return [
        queryKeys.schedules.all,
        queryKeys.schedules.today(),
        queryKeys.schedules.upcoming(),
        queryKeys.schedules.overdue(),
      ];
    
    case 'patient.create':
    case 'patient.update':
    case 'patient.delete':
      return [
        queryKeys.patients.all,
      ];
    
    case 'execution.complete':
      return [
        queryKeys.executions.all,
        queryKeys.schedules.all,
        queryKeys.schedules.today(),
        queryKeys.schedules.upcoming(),
      ];
    
    default:
      return [];
  }
};