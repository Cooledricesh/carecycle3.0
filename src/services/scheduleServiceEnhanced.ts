'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'
import { format } from 'date-fns'
import {
  FilterStrategyFactory,
  FilterOptions,
  UserContext,
  FilterStatistics
} from './filters'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface PerformanceMetrics {
  queryTime: number
  cacheHit: boolean
  rowCount: number
}

export class ScheduleServiceEnhanced {
  private static instance: ScheduleServiceEnhanced | null = null
  private cache = new Map<string, CacheEntry<any>>()
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
   */
  async getFilteredSchedules(
    filters: FilterOptions,
    userContext: UserContext,
    supabase?: SupabaseClient<Database>
  ): Promise<{
    schedules: any[]  // Returns transformed data that UI expects
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

    console.log('[scheduleServiceEnhanced] Strategy selected:', strategy.getQueryName())

    // Check cache first
    const cacheKey = strategy.getCacheKey(filters, userContext)
    const cached = this.getFromCache<any[]>(cacheKey)

    if (cached) {
      const metrics: PerformanceMetrics = {
        queryTime: performance.now() - startTime,
        cacheHit: true,
        rowCount: cached.length
      }
      this.recordMetrics(strategy.getQueryName(), metrics)

      console.log(`[Cache HIT] ${cacheKey}: ${cached.length} records`)

      return {
        schedules: cached,
        metrics
      }
    }

    try {
      // Execute server-side query
      console.log('[scheduleServiceEnhanced] About to execute buildQuery with:', {
        filters,
        userContext,
        strategyName: strategy.getQueryName()
      })

      const { data, error } = await strategy.buildQuery(client as any, filters, userContext)

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

      const flatSchedules = data || []

      // Transform flattened data to nested format for UI compatibility
      const schedules = flatSchedules.map((s: any) => {
        // If it's already in nested format with camelCase, return as is
        if (s.patient && s.item && s.id) {
          return s
        }

        // If it's in nested format with patients/items (plural), transform to singular
        if (s.patients || s.items) {
          return {
            // Keep both naming conventions for compatibility
            id: s.id,
            patient_id: s.patient_id,
            patientId: s.patient_id,
            item_id: s.item_id,
            itemId: s.item_id,
            next_due_date: s.next_due_date,
            nextDueDate: s.next_due_date,
            interval_weeks: s.interval_weeks,
            intervalWeeks: s.interval_weeks,
            status: s.status,
            notes: s.notes,
            created_at: s.created_at,
            createdAt: s.created_at,
            updated_at: s.updated_at,
            updatedAt: s.updated_at,
            patient: s.patients || null,
            item: s.items || null
          }
        }

        // Transform from flattened RPC format to nested format
        // Keep both snake_case and camelCase for backward compatibility
        return {
          // CRITICAL: Map schedule_id for ScheduleWithDetails type compatibility
          schedule_id: s.schedule_id || s.id,  // UI expects schedule_id
          // Main schedule properties with both naming conventions
          // Prefer s.id (DB primary key if present), then s.schedule_id (RPC renamed PK), then composite fallback
          id: s.id || s.schedule_id || `${s.patient_id}-${s.item_id}-temp`,
          patient_id: s.patient_id,  // snake_case for compatibility
          patientId: s.patient_id,   // camelCase
          item_id: s.item_id,        // snake_case
          itemId: s.item_id,         // camelCase
          next_due_date: s.next_due_date,  // snake_case (used by calendar)
          nextDueDate: s.next_due_date,    // camelCase
          interval_weeks: s.interval_weeks, // snake_case
          intervalWeeks: s.interval_weeks,  // camelCase
          status: s.status,
          notes: s.notes,
          created_at: s.created_at,  // snake_case
          createdAt: s.created_at,   // camelCase
          updated_at: s.updated_at,  // snake_case
          updatedAt: s.updated_at,   // camelCase
          // IMPORTANT: Preserve display_type for completed schedule UI
          display_type: s.display_type || 'scheduled',
          execution_id: s.execution_id,
          executed_by: s.executed_by,
          // Add flat fields for backward compatibility with CalendarDayCard
          patient_name: s.patient_name || '',
          patient_care_type: s.patient_care_type || '',
          patient_number: s.patient_number || '',
          item_name: s.item_name || '',
          item_category: s.item_category || '',
          // Create nested patient object
          patient: s.patient_name ? {
            id: s.patient_id,
            name: s.patient_name,
            careType: s.patient_care_type,
            care_type: s.patient_care_type,  // Both formats
            patientNumber: s.patient_number,
            patient_number: s.patient_number, // Both formats
            doctorId: s.doctor_id,
            doctor_id: s.doctor_id  // Both formats
          } : null,
          // Create nested item object
          item: s.item_name ? {
            id: s.item_id,
            name: s.item_name,
            category: s.item_category
          } : null
        }
      })

      // Cache the result
      this.setCache(cacheKey, schedules, strategy.getCacheTTL())

      // Record metrics
      const metrics: PerformanceMetrics = {
        queryTime: performance.now() - startTime,
        cacheHit: false,
        rowCount: schedules.length
      }
      this.recordMetrics(strategy.getQueryName(), metrics)

      console.log(`[DB Query] ${cacheKey}: ${schedules.length} records in ${metrics.queryTime.toFixed(2)}ms`)

      // Optionally fetch statistics
      const statistics = await this.getFilterStatistics(userContext, client as any) ?? undefined

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
    } catch (error: any) {
      console.error('[scheduleServiceEnhanced] Error fetching filtered schedules:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error
      })
      throw new Error('일정 조회에 실패했습니다')
    }
  }

  /**
   * Get today's checklist with completion status
   */
  async getTodayChecklist(
    showAll: boolean,
    userContext: UserContext,
    supabase?: SupabaseClient<Database>
  ): Promise<any[]> {
    const client = supabase || createClient()

    console.log('[getTodayChecklist] Fetching today\'s checklist:', {
      userId: userContext.userId,
      showAll,
      role: userContext.role
    })

    try {
      // Skip RPC call completely - go directly to optimized query
      // RPC function doesn't exist in current migration, using direct query instead
      const today = format(new Date(), 'yyyy-MM-dd')

      console.log('[getTodayChecklist] Querying for today and overdue schedules up to:', today)

      let query = (client as any)
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
        .lte('next_due_date', today)  // Less than or equal to today (includes overdue)
        .eq('status', 'active')
        .eq('organization_id', userContext.organizationId)

      // Apply role-based filtering
      if (!showAll && userContext.role !== 'admin') {
        if (userContext.role === 'doctor') {
          query = query.eq('patients.doctor_id', userContext.userId)
        } else if (userContext.role === 'nurse' && userContext.departmentId) {
          query = query.eq('patients.department_id', userContext.departmentId)
        }
      }

      const { data: schedules, error: queryError } = await query as {
        data: Array<{
          id: string
          patient_id: string
          item_id: string
          next_due_date: string
          interval_weeks: number
          notes: string | null
          status: string
          created_at: string
          updated_at: string
          patients: {
            id: string
            name: string
            department_id: string | null
            departments: {
              name: string
            } | null
            doctor_id: string | null
            assigned_doctor_name: string | null
            patient_number: string
            profiles: {
              name: string
            } | null
          }
          items: {
            id: string
            name: string
            category: string
          }
        }> | null
        error: any
      }

      if (queryError) {
        throw queryError
      }

      console.log('[getTodayChecklist] Query successful:', schedules?.length || 0, 'items')

      // Transform the data to match expected format used by UI
      return (schedules || []).map(s => ({
        // Map 'id' to 'schedule_id' to match ScheduleWithDetails type
        schedule_id: s.id,  // IMPORTANT: UI expects schedule_id, not id
        // Keep both naming conventions for compatibility
        id: s.id,
        patient_id: s.patient_id,
        patientId: s.patient_id,
        item_id: s.item_id,
        itemId: s.item_id,
        next_due_date: s.next_due_date,
        nextDueDate: s.next_due_date,
        interval_weeks: s.interval_weeks,
        intervalWeeks: s.interval_weeks,
        status: s.status,
        notes: s.notes,
        created_at: s.created_at,
        createdAt: s.created_at,
        updated_at: s.updated_at,
        updatedAt: s.updated_at,
        // Add flat fields for UI compatibility
        patient_name: s.patients?.name || '',
        patient_care_type: s.patients?.departments?.name || '',
        patient_number: s.patients?.patient_number || '',
        item_name: s.items?.name || '',
        item_category: s.items?.category || '',
        doctor_id: s.patients?.doctor_id || null,
        // COALESCE: registered doctor name -> unregistered doctor name -> fallback
        doctor_name: s.patients?.profiles?.name || s.patients?.assigned_doctor_name || '미지정',
        // Nested patient object
        patient: s.patients ? {
            id: s.patients.id,
            name: s.patients.name,
            care_type: s.patients.departments?.name || '',
            careType: s.patients.departments?.name || '',
            department_id: s.patients.department_id,
            departmentId: s.patients.department_id,
            doctor_id: s.patients.doctor_id,
            doctorId: s.patients.doctor_id,
            patient_number: s.patients.patient_number,
            patientNumber: s.patients.patient_number
          } : null,
          // Nested item object
          item: s.items ? {
            id: s.items.id,
            name: s.items.name,
            category: s.items.category
          } : null
        }))

    } catch (error: any) {
      console.error('Error fetching today checklist:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })

      // Return empty array instead of throwing to prevent complete failure
      console.log('[getTodayChecklist] Returning empty array due to error')
      return []
    }
  }

  /**
   * Get filter statistics for the user
   */
  async getFilterStatistics(
    userContext: UserContext,
    supabase?: SupabaseClient<Database>
  ): Promise<FilterStatistics | null> {
    const client = supabase || createClient()
    const cacheKey = `stats:${userContext.role}:${userContext.userId}`

    // Check cache (shorter TTL for statistics)
    const cached = this.getFromCache<FilterStatistics>(cacheKey, 60) // 1 minute cache

    if (cached) {
      return cached
    }

    const { data, error } = await (client as any).rpc('get_filter_statistics', {
      p_user_id: userContext.userId,
      p_organization_id: userContext.organizationId
    })

    if (error) {
      console.error('Error fetching filter statistics:', error)
      return null
    }

    if (data && data.length > 0) {
      // Transform snake_case from DB to camelCase for TypeScript interface
      const dbStats = data[0] as any
      const stats: FilterStatistics = {
        totalPatients: dbStats.total_patients || 0,
        myPatients: dbStats.my_patients || 0,
        totalSchedules: dbStats.total_schedules || 0,
        todaySchedules: dbStats.today_schedules || 0,
        overdueSchedules: dbStats.overdue_schedules || 0,
        upcomingSchedules: dbStats.upcoming_schedules || 0
      }
      this.setCache(cacheKey, stats, 60)
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
    const client = supabase || createClient()

    const { error } = await (client as any).rpc('refresh_dashboard_summary')

    if (error) {
      console.error('Error refreshing dashboard summary:', error)
      return false
    }

    // Clear all caches after refresh
    this.clearCache()
    return true
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string, customTtl?: number): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const ttl = customTtl || entry.ttl
    if (Date.now() - entry.timestamp > ttl * 1000) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  private setCache<T>(key: string, data: T, ttlSeconds: number): void {
    // Limit cache size to prevent memory issues
    if (this.cache.size > 100) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 20)
      keysToDelete.forEach(k => this.cache.delete(k))
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    })
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateUserCache(userId: string, role?: string): void {
    const pattern = role
      ? new RegExp(`^schedules:${role}:${userId}:`)
      : new RegExp(`:${userId}:`)

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear()
    FilterStrategyFactory.clearCache()
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

  getCacheHitRate(operation?: string): number {
    const metrics = operation
      ? this.metrics.get(operation) || []
      : Array.from(this.metrics.values()).flat()

    if (metrics.length === 0) return 0

    const hits = metrics.filter(m => m.cacheHit).length
    return (hits / metrics.length) * 100
  }

  getPerformanceSummary(): {
    operations: { [key: string]: { avgTime: number; cacheHitRate: number } }
    overall: { avgTime: number; cacheHitRate: number }
  } {
    const operations: { [key: string]: { avgTime: number; cacheHitRate: number } } = {}

    for (const [operation] of this.metrics) {
      operations[operation] = {
        avgTime: this.getAverageQueryTime(operation),
        cacheHitRate: this.getCacheHitRate(operation)
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
        cacheHitRate: this.getCacheHitRate()
      }
    }
  }
}

// Export singleton instance
export const scheduleServiceEnhanced = ScheduleServiceEnhanced.getInstance()