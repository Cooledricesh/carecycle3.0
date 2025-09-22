'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'
import { format } from 'date-fns'
import {
  FilterStrategyFactory,
  FilterOptions,
  UserContext,
  ScheduleWithDetails,
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
    schedules: ScheduleWithDetails[]
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
    const cached = this.getFromCache<ScheduleWithDetails[]>(cacheKey)

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

      const { data, error } = await strategy.buildQuery(client, filters, userContext)

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

      const schedules = data || []

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
      const statistics = await this.getFilterStatistics(userContext, client)

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

    console.log('[getTodayChecklist] Attempting to fetch today\'s checklist:', {
      userId: userContext.userId,
      showAll,
      role: userContext.role
    })

    try {
      // Try the new function signature first
      const { data, error } = await client.rpc('get_today_checklist', {
        p_user_id: userContext.userId,
        p_show_all: showAll
      })

      if (!error && data) {
        console.log('[getTodayChecklist] Successfully fetched with new signature:', data.length, 'items')
        return data
      }

      // If there's an error about function not existing, fall back to direct query
      if (error?.message?.includes('function') || error?.message?.includes('exist')) {
        console.log('[getTodayChecklist] RPC function issue, falling back to direct query')

        // Fallback: Query schedules directly for today
        const today = new Date().toISOString().split('T')[0]

        let query = client
          .from('schedules')
          .select(`
            id,
            patient_id,
            item_id,
            next_due_date,
            status,
            patients!inner (
              id,
              name,
              care_type,
              doctor_id
            ),
            items!inner (
              name,
              category
            )
          `)
          .eq('next_due_date', today)
          .eq('status', 'active')

        // Apply role-based filtering
        if (!showAll && userContext.role !== 'admin') {
          if (userContext.role === 'doctor') {
            query = query.eq('patients.doctor_id', userContext.userId)
          } else if (userContext.role === 'nurse' && userContext.careType) {
            query = query.eq('patients.care_type', userContext.careType)
          }
        }

        const { data: schedules, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        console.log('[getTodayChecklist] Fallback query successful:', schedules?.length || 0, 'items')

        // Transform the data to match expected format
        return (schedules || []).map(s => ({
          schedule_id: s.id,
          patient_id: s.patient_id,
          patient_name: s.patients?.name || '',
          patient_care_type: s.patients?.care_type || '',
          doctor_id: s.patients?.doctor_id,
          item_name: s.items?.name || '',
          item_category: s.items?.category || '',
          status: s.status,
          completed: false // Would need a separate query for completion status
        }))
      }

      // Other errors, throw them
      throw error

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

    const { data, error } = await client.rpc('get_filter_statistics', {
      p_user_id: userContext.userId
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

    const { error } = await client.rpc('refresh_dashboard_summary')

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