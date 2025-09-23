import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

export interface UserContext {
  userId: string
  role: 'doctor' | 'nurse' | 'admin'
  careType?: string | null
}

export interface FilterOptions {
  showAll?: boolean
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
  ): Promise<any>

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

// Import the centralized ScheduleWithDetails type
export type { ScheduleWithDetails } from '@/types/schedule'