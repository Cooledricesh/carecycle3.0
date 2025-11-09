import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import type { ScheduleWithDetails } from '@/types/schedule'

export interface UserContext {
  userId: string
  role: 'doctor' | 'nurse' | 'admin' | 'super_admin'
  careType?: string | null // DEPRECATED: Legacy care_type value for backward compatibility
  departmentId?: string | null // New: UUID reference to departments table
  organizationId: string | null // Allow null for super_admin
}

export interface FilterOptions {
  showAll?: boolean
  // Phase 1: department_ids contain care_type values (외래/입원/낮병원)
  // Phase 2: will contain UUID references to departments table
  department_ids?: string[]
  // DEPRECATED: Legacy careTypes field (kept for backward compatibility)
  careTypes?: string[]
  doctorId?: string | null
  department?: string | null
  dateRange?: {
    start: string
    end: string
  } | null
  includeInactive?: boolean
  urgencyLevel?: 'all' | 'urgent' | 'normal'
}

export interface FilterStrategy {
  buildQuery(
    supabase: SupabaseClient<Database>,
    filters: FilterOptions,
    userContext: UserContext
  ): Promise<{ data: ScheduleWithDetails[] | null; error: Error | null }>

  getCacheKey(filters: FilterOptions, userContext: UserContext): string
  getCacheTTL(): number
  getQueryName(): string
}

export interface FilterStatistics {
  totalPatients: number
  myPatients: number
  totalSchedules: number
  todaySchedules: number
  overdueSchedules: number
  upcomingSchedules: number
}

// Re-export the centralized ScheduleWithDetails type
export type { ScheduleWithDetails } from '@/types/schedule'