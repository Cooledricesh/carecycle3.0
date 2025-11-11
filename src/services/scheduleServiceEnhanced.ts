'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'
import { format, addDays } from 'date-fns'
import {
  FilterStrategyFactory,
  FilterOptions,
  UserContext,
  FilterStatistics,
  ScheduleWithDetails
} from './filters'
import {
  RpcFlatSchedule,
  DbNestedSchedule,
  UiSchedule,
  isRpcFlatSchedule,
  isDbNestedSchedule
} from '@/types/schedule-data-formats'

/**
 * Performance Metrics Interface
 * Tracks query performance without caching
 */
interface PerformanceMetrics {
  queryTime: number
  rowCount: number
  strategyName: string
}

/**
 * Enhanced Schedule Service
 *
 * Responsibilities:
 * 1. Data transformation (RPC/DB → UI format)
 * 2. Performance monitoring
 * 3. Role-based data fetching
 *
 * NOT Responsible For:
 * - Caching (delegated to React Query)
 * - Direct database access (delegated to FilterStrategy)
 */
export class ScheduleServiceEnhanced {
  private static instance: ScheduleServiceEnhanced | null = null
  private metrics = new Map<string, PerformanceMetrics[]>()

  // Singleton pattern
  static getInstance(): ScheduleServiceEnhanced {
    if (!this.instance) {
      this.instance = new ScheduleServiceEnhanced()
    }
    return this.instance
  }

  /**
   * Get filtered schedules using server-side filtering
   * @returns Transformed schedules in UI format
   */
  async getFilteredSchedules(
    filters: FilterOptions,
    userContext: UserContext,
    supabase?: SupabaseClient<Database>
  ): Promise<{
    schedules: UiSchedule[]
    statistics?: FilterStatistics
    metrics?: PerformanceMetrics
  }> {
    const startTime = performance.now()
    const client = supabase || createClient()

    console.log('[scheduleServiceEnhanced] Creating strategy for:', {
      userId: userContext.userId,
      role: userContext.role,
      careType: userContext.careType
    })

    const strategy = FilterStrategyFactory.create(userContext)
    const strategyName = strategy.getQueryName()

    console.log('[scheduleServiceEnhanced] Strategy selected:', strategyName)

    try {
      // Execute server-side query
      console.log('[scheduleServiceEnhanced] About to execute buildQuery with:', {
        filters,
        userContext,
        strategyName
      })

      const { data, error } = await strategy.buildQuery(
        client as SupabaseClient<Database>,
        filters,
        userContext
      )

      console.log('[scheduleServiceEnhanced] buildQuery result:', {
        hasData: !!data,
        dataLength: data?.length || 0,
        hasError: !!error,
        error: error
      })

      if (error) {
        console.error('[scheduleServiceEnhanced] Strategy buildQuery error:', error)
        throw error
      }

      const rawData = data || []

      // Transform data using type-safe transformers
      const schedules = rawData.map(item => this.transformToUiFormat(item))

      // Record metrics
      const metrics: PerformanceMetrics = {
        queryTime: performance.now() - startTime,
        rowCount: schedules.length,
        strategyName
      }
      this.recordMetrics(strategyName, metrics)

      console.log(`[DB Query] ${strategyName}: ${schedules.length} records in ${metrics.queryTime.toFixed(2)}ms`)

      // Optionally fetch statistics
      const statistics = await this.getFilterStatistics(userContext, client as SupabaseClient<Database>) ?? undefined

      console.log('[scheduleServiceEnhanced] Returning:', {
        schedulesCount: schedules.length,
        hasStatistics: !!statistics,
        firstSchedule: schedules[0]
      })

      return {
        schedules,
        statistics,
        metrics
      }
    } catch (error: unknown) {
      const err = error as { message?: string; details?: unknown; hint?: string; code?: string }
      console.error('[scheduleServiceEnhanced] Error fetching filtered schedules:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        fullError: error
      })
      throw new Error('일정 조회에 실패했습니다')
    }
  }

  /**
   * Transform any data format to UI format using type guards
   * Handles: RPC flat, DB nested, already UI format
   */
  private transformToUiFormat(data: unknown): UiSchedule {
    // Type guard: Already UI format
    if (this.isUiFormat(data)) {
      return data as UiSchedule
    }

    // Type guard: RPC flat format
    if (isRpcFlatSchedule(data)) {
      return this.transformRpcToUi(data)
    }

    // Type guard: DB nested format
    if (isDbNestedSchedule(data)) {
      return this.transformDbToUi(data)
    }

    // Fallback: Assume RPC-like structure
    console.warn('[transformToUiFormat] Unknown format, attempting RPC transformation:', data)
    return this.transformRpcToUi(data as RpcFlatSchedule)
  }

  /**
   * Check if data is already in UI format
   */
  private isUiFormat(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false
    const d = data as Record<string, unknown>
    return (
      'schedule_id' in d &&
      'patient_name' in d &&
      'doctor_name' in d &&
      'item_name' in d &&
      !('patients' in d)  // UI format doesn't have nested patients
    )
  }

  /**
   * Transform RPC flat format to UI format
   */
  private transformRpcToUi(rpc: RpcFlatSchedule): UiSchedule {
    return {
      // Schedule identifiers
      schedule_id: rpc.schedule_id,
      id: rpc.schedule_id,

      // Patient data (flat)
      patient_id: rpc.patient_id,
      patient_name: rpc.patient_name,
      patient_care_type: rpc.patient_care_type || '',
      patient_number: rpc.patient_number,

      // Doctor data (flat)
      doctor_id: rpc.doctor_id,
      doctor_name: rpc.doctor_name || '미지정',

      // Item data (flat)
      item_id: rpc.item_id,
      item_name: rpc.item_name,
      item_category: rpc.item_category,

      // Schedule data
      next_due_date: rpc.next_due_date,
      interval_weeks: rpc.interval_weeks,
      status: rpc.schedule_status,
      priority: rpc.priority,
      notes: rpc.notes,

      // Display metadata
      display_type: rpc.display_type,

      // Execution metadata
      execution_id: rpc.execution_id,
      executed_by: rpc.executed_by,
      doctor_id_at_completion: rpc.doctor_id_at_completion,
      care_type_at_completion: rpc.care_type_at_completion,

      // Audit (provide defaults if missing)
      created_at: rpc.created_at || new Date().toISOString(),
      updated_at: rpc.updated_at || new Date().toISOString(),

      // Nested objects (for components that need them)
      patient: {
        id: rpc.patient_id,
        name: rpc.patient_name,
        care_type: rpc.patient_care_type || '',
        careType: rpc.patient_care_type || '',
        patient_number: rpc.patient_number,
        patientNumber: rpc.patient_number,
        doctor_id: rpc.doctor_id,
        doctorId: rpc.doctor_id
      },

      item: {
        id: rpc.item_id,
        name: rpc.item_name,
        category: rpc.item_category
      }
    }
  }

  /**
   * Transform DB nested format to UI format
   */
  private transformDbToUi(db: DbNestedSchedule): UiSchedule {
    const patient = db.patients
    const item = db.items

    // COALESCE pattern for doctor name
    const doctorName = patient?.profiles?.name || patient?.assigned_doctor_name || '미지정'

    return {
      // Schedule identifiers
      schedule_id: db.id,
      id: db.id,

      // Patient data (flat)
      patient_id: db.patient_id,
      patient_name: patient?.name || '',
      patient_care_type: patient?.departments?.name || '',
      patient_number: patient?.patient_number || '',

      // Doctor data (flat)
      doctor_id: patient?.doctor_id || null,
      doctor_name: doctorName,

      // Item data (flat)
      item_id: db.item_id,
      item_name: item?.name || '',
      item_category: item?.category || ('other' as const),

      // Schedule data
      next_due_date: db.next_due_date,
      interval_weeks: db.interval_weeks,
      status: db.status,
      priority: db.priority,
      notes: db.notes,

      // Audit (provide defaults if missing)
      created_at: db.created_at || new Date().toISOString(),
      updated_at: db.updated_at || new Date().toISOString(),

      // Nested objects (if patient/item exist)
      patient: patient ? {
        id: patient.id,
        name: patient.name,
        care_type: patient.departments?.name || '',
        careType: patient.departments?.name || '',
        patient_number: patient.patient_number,
        patientNumber: patient.patient_number,
        doctor_id: patient.doctor_id || null,
        doctorId: patient.doctor_id || null
      } : null,

      item: item ? {
        id: item.id,
        name: item.name,
        category: item.category
      } : null
    }
  }

  /**
   * Get today's checklist with completion status
   */
  async getTodayChecklist(
    showAll: boolean,
    userContext: UserContext,
    supabase?: SupabaseClient<Database>,
    departmentIds?: string[]
  ): Promise<UiSchedule[]> {
    const client = (supabase || createClient()) as any

    console.log('[getTodayChecklist] Fetching today\'s checklist:', {
      userId: userContext.userId,
      showAll,
      role: userContext.role,
      departmentIds
    })

    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      console.log('[getTodayChecklist] Querying for today and overdue schedules up to:', today)

      let query = client
        .from('schedules')
        .select(`
          id,
          patient_id,
          item_id,
          next_due_date,
          interval_weeks,
          notes,
          status,
          created_at,
          updated_at,
          patients!inner (
            id,
            name,
            department_id,
            departments (
              name
            ),
            doctor_id,
            assigned_doctor_name,
            patient_number,
            profiles:doctor_id (
              name
            )
          ),
          items!inner (
            id,
            name,
            category
          )
        `)
        .eq('status', 'active')

      // Apply organization filter (skip for super_admin who has null organization_id)
      if (userContext.organizationId) {
        query = query.eq('organization_id', userContext.organizationId)
      }

      // Apply date filter after organization filter
      query = query.lte('next_due_date', today)

      // Apply role-based filtering
      if (!showAll && userContext.role !== 'admin') {
        if (userContext.role === 'doctor') {
          query = query.eq('patients.doctor_id', userContext.userId)
        } else if (userContext.role === 'nurse' && userContext.departmentId) {
          query = query.eq('patients.department_id', userContext.departmentId)
        }
      }

      // Apply department filter for admin (if specified)
      if (departmentIds && departmentIds.length > 0) {
        // Validate UUIDs
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const validUuids = departmentIds.filter(id => UUID_REGEX.test(id))
        if (validUuids.length > 0) {
          query = query.in('patients.department_id', validUuids)
        }
      }

      // Add ordering (only by schedules table columns - cannot order by joined table columns in PostgREST)
      query = query.order('next_due_date', { ascending: true })

      const { data: schedules, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      console.log('[getTodayChecklist] Query successful:', schedules?.length || 0, 'items')

      // Transform using type-safe transformer
      const transformed = (schedules || []).map((s: any) => this.transformDbToUi(s as DbNestedSchedule))

      // Sort by patient name on client side (cannot do in PostgREST with joined tables)
      return transformed.sort((a: UiSchedule, b: UiSchedule) => {
        if (a.next_due_date === b.next_due_date) {
          return (a.patient_name || '').localeCompare(b.patient_name || '')
        }
        return 0
      })

    } catch (error: unknown) {
      const err = error as { message?: string; details?: unknown; hint?: string; code?: string }
      console.error('Error fetching today checklist:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code
      })

      // Return empty array instead of throwing to prevent complete failure
      console.log('[getTodayChecklist] Returning empty array due to error')
      return []
    }
  }

  /**
   * Get upcoming schedules (within execution window: 7 days before to 7 days after due date)
   * Uses same JOIN pattern as getTodayChecklist to ensure data consistency
   */
  async getUpcomingSchedules(
    daysAhead: number,
    showAll: boolean,
    userContext: UserContext,
    supabase?: SupabaseClient<Database>,
    departmentIds?: string[]
  ): Promise<UiSchedule[]> {
    const client = (supabase || createClient()) as any

    console.log('[getUpcomingSchedules] Fetching upcoming schedules:', {
      userId: userContext.userId,
      daysAhead,
      showAll,
      role: userContext.role,
      departmentIds
    })

    try {
      const today = new Date()
      const futureDate = format(addDays(today, daysAhead), 'yyyy-MM-dd')
      const pastDate = format(addDays(today, -7), 'yyyy-MM-dd')

      console.log('[getUpcomingSchedules] Date range:', { pastDate, futureDate })

      let query = client
        .from('schedules')
        .select(`
          id,
          patient_id,
          item_id,
          next_due_date,
          interval_weeks,
          notes,
          status,
          created_at,
          updated_at,
          patients!inner (
            id,
            name,
            department_id,
            departments (
              name
            ),
            doctor_id,
            assigned_doctor_name,
            patient_number,
            profiles:doctor_id (
              name
            )
          ),
          items!inner (
            id,
            name,
            category
          )
        `)
        .gte('next_due_date', pastDate)
        .lte('next_due_date', futureDate)
        .eq('status', 'active')
        .order('next_due_date', { ascending: true })

      // Apply organization filter (skip for super_admin who has null organization_id)
      if (userContext.organizationId) {
        query = query.eq('organization_id', userContext.organizationId)
      }

      // Apply role-based filtering
      if (!showAll && userContext.role !== 'admin') {
        if (userContext.role === 'doctor') {
          query = query.eq('patients.doctor_id', userContext.userId)
        } else if (userContext.role === 'nurse' && userContext.departmentId) {
          query = query.eq('patients.department_id', userContext.departmentId)
        }
      }

      // Apply department filter for admin (if specified)
      if (departmentIds && departmentIds.length > 0) {
        // Validate UUIDs
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const validUuids = departmentIds.filter(id => UUID_REGEX.test(id))
        if (validUuids.length > 0) {
          query = query.in('patients.department_id', validUuids)
        }
      }

      const { data: schedules, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      console.log('[getUpcomingSchedules] Query successful:', schedules?.length || 0, 'items')

      // Transform using type-safe transformer
      return (schedules || []).map((s: any) => this.transformDbToUi(s as DbNestedSchedule))

    } catch (error: unknown) {
      const err = error as { message?: string; details?: unknown; hint?: string; code?: string }
      console.error('Error fetching upcoming schedules:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code
      })

      // Return empty array instead of throwing to prevent complete failure
      console.log('[getUpcomingSchedules] Returning empty array due to error')
      return []
    }
  }

  // Keep getTodayChecklist error handling consistent
  private handleTodayChecklistError(error: unknown): UiSchedule[] {
    const err = error as { message?: string; details?: unknown; hint?: string; code?: string }
    console.error('Error fetching today checklist:', {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code
    })

    // Return empty array instead of throwing to prevent complete failure
    console.log('[getTodayChecklist] Returning empty array due to error')
    return []
  }

  /**
   * Get filter statistics for the user
   * NOTE: Still uses internal caching due to expensive computation
   */
  async getFilterStatistics(
    userContext: UserContext,
    supabase?: SupabaseClient<Database>
  ): Promise<FilterStatistics | null> {
    const client = (supabase || createClient()) as any

    const { data, error } = await client.rpc('get_filter_statistics', {
      p_user_id: userContext.userId,
      p_organization_id: userContext.organizationId
    })

    if (error) {
      console.error('Error fetching filter statistics:', error)
      return null
    }

    if (data && data.length > 0) {
      // Transform snake_case from DB to camelCase for TypeScript interface
      const dbStats = data[0] as Record<string, number>
      const stats: FilterStatistics = {
        totalPatients: dbStats.total_patients || 0,
        myPatients: dbStats.my_patients || 0,
        totalSchedules: dbStats.total_schedules || 0,
        todaySchedules: dbStats.today_schedules || 0,
        overdueSchedules: dbStats.overdue_schedules || 0,
        upcomingSchedules: dbStats.upcoming_schedules || 0
      }
      return stats
    }

    return null
  }

  /**
   * Refresh materialized view (admin only)
   */
  async refreshDashboardSummary(
    supabase?: SupabaseClient<Database>
  ): Promise<boolean> {
    const client = (supabase || createClient()) as any

    const { error } = await client.rpc('refresh_dashboard_summary')

    if (error) {
      console.error('Error refreshing dashboard summary:', error)
      return false
    }

    return true
  }

  /**
   * Performance monitoring
   */
  private recordMetrics(operation: string, metrics: PerformanceMetrics): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metrics)

    // Keep only last 100 measurements
    if (operationMetrics.length > 100) {
      operationMetrics.shift()
    }
  }

  getAverageQueryTime(operation: string): number {
    const metrics = this.metrics.get(operation) || []
    if (metrics.length === 0) return 0

    const totalTime = metrics.reduce((sum, m) => sum + m.queryTime, 0)
    return totalTime / metrics.length
  }

  getPerformanceSummary(): {
    operations: { [key: string]: { avgTime: number; count: number } }
    overall: { avgTime: number; totalQueries: number }
  } {
    const operations: { [key: string]: { avgTime: number; count: number } } = {}

    for (const [operation] of this.metrics) {
      const opMetrics = this.metrics.get(operation) || []
      operations[operation] = {
        avgTime: this.getAverageQueryTime(operation),
        count: opMetrics.length
      }
    }

    const allMetrics = Array.from(this.metrics.values()).flat()
    const overallAvgTime = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.queryTime, 0) / allMetrics.length
      : 0

    return {
      operations,
      overall: {
        avgTime: overallAvgTime,
        totalQueries: allMetrics.length
      }
    }
  }

  /**
   * Clear cache - kept for compatibility but delegates to React Query
   * React Query handles all caching now
   */
  clearCache(): void {
    // No local cache to clear
    // This method is kept for backward compatibility
    console.log('[scheduleServiceEnhanced] clearCache called - caching delegated to React Query')
    FilterStrategyFactory.clearCache()
  }
}

// Export singleton instance
export const scheduleServiceEnhanced = ScheduleServiceEnhanced.getInstance()
