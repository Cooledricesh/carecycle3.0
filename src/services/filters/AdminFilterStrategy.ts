'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { FilterStrategy, FilterOptions, UserContext, ScheduleWithDetails } from './types'

export class AdminFilterStrategy implements FilterStrategy {
  async buildQuery(
    supabase: SupabaseClient<Database>,
    filters: FilterOptions,
    userContext: UserContext
  ): Promise<{ data: ScheduleWithDetails[] | null; error: Error | null }> {
    // Admin always sees all data, showAll flag is ignored
    console.log('[AdminFilterStrategy] Attempting RPC call')

    // For calendar views with date range, use the calendar-specific function
    if (filters.dateRange?.start && filters.dateRange?.end) {
      const { data: calendarData, error: calendarError } = await supabase.rpc('get_calendar_schedules_filtered', {
        p_start_date: filters.dateRange.start,
        p_end_date: filters.dateRange.end,
        p_user_id: userContext.userId,
        p_show_all: true, // Admin always has full access
        p_care_types: filters.careTypes?.length ? filters.careTypes : null
      })

      if (calendarError) {
        console.error('[AdminFilterStrategy] Calendar RPC error:', calendarError)
      }

      if (!calendarError && calendarData) {
        console.log('[AdminFilterStrategy] Calendar RPC successful:', {
          dataLength: calendarData.length || 0,
          dateRange: filters.dateRange,
          hasCompletedItems: calendarData.some((item: Record<string, any>) => item.display_type === 'completed')
        })

        // Transform calendar data to ScheduleWithDetails format
        const transformedData = calendarData.map((item: Record<string, any>) => ({
          schedule_id: item.schedule_id,
          patient_id: item.patient_id,
          patient_name: item.patient_name,
          patient_care_type: item.care_type,
          patient_number: '',
          doctor_id: item.doctor_id,
          doctor_name: '',
          item_id: item.item_id,
          item_name: item.item_name,
          item_category: item.item_category,
          next_due_date: item.display_date,
          interval_weeks: item.interval_weeks,
          priority: item.priority,
          status: item.schedule_status,
          display_type: item.display_type,
          execution_id: item.execution_id,
          executed_by: item.executed_by,
          notes: item.execution_notes,
          doctor_id_at_completion: item.doctor_id_at_completion,
          care_type_at_completion: item.care_type_at_completion
        }))

        return {
          data: transformedData,
          error: null
        }
      }
    }

    // Try regular RPC for non-calendar views
    const { data, error } = await supabase.rpc('get_filtered_schedules', {
      p_user_id: userContext.userId,
      p_show_all: true, // Admin always has full access
      p_care_types: filters.careTypes?.length ? filters.careTypes : null,
      p_date_start: filters.dateRange?.start || null,
      p_date_end: filters.dateRange?.end || null
    })

    if (!error && data) {
      console.log('[AdminFilterStrategy] RPC successful:', data.length, 'items')
      return {
        data: data as ScheduleWithDetails[],
        error: null
      }
    }

    // Fallback to direct query
    console.log('[AdminFilterStrategy] RPC failed, using fallback:', error?.message)

    let query = supabase
      .from('schedules')
      .select(`
        id,
        patient_id,
        item_id,
        next_due_date,
        interval_weeks,
        status,
        notes,
        priority,
        created_at,
        updated_at,
        patients!inner (
          name,
          care_type,
          patient_number
        ),
        items!inner (
          name,
          category
        )
      `)
      .in('status', ['active', 'paused'])

    // Admin can filter by care types if specified
    if (filters.careTypes?.length) {
      query = query.in('patients.care_type', filters.careTypes)
    }

    // Apply date range
    if (filters.dateRange) {
      if (filters.dateRange.start) {
        query = query.gte('next_due_date', filters.dateRange.start)
      }
      if (filters.dateRange.end) {
        query = query.lte('next_due_date', filters.dateRange.end)
      }
    }

    // Apply urgency level filter if specified
    if (filters.urgencyLevel && filters.urgencyLevel !== 'all') {
      if (filters.urgencyLevel === 'urgent') {
        query = query.gte('priority', 7)
      } else if (filters.urgencyLevel === 'normal') {
        query = query.lt('priority', 7)
      }
    }

    const { data: schedules, error: queryError } = await query

    if (queryError) {
      console.error('[AdminFilterStrategy] Fallback error:', queryError)
      return { data: null, error: queryError }
    }

    const transformedData = (schedules || []).map((s: Record<string, any>) => ({
      schedule_id: s.id,
      patient_id: s.patient_id,
      patient_name: s.patients?.name || '',
      patient_care_type: s.patients?.care_type || '',
      patient_number: s.patients?.patient_number || '',
      doctor_id: null, // Not available in current schema
      doctor_name: '',
      item_id: s.item_id,
      item_name: s.items?.name || '',
      item_category: s.items?.category || '',
      next_due_date: s.next_due_date,
      interval_weeks: s.interval_weeks || 1,
      priority: s.priority ?? 0,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      notes: s.notes || null
    }))

    console.log('[AdminFilterStrategy] Fallback result:', transformedData.length, 'items')

    return {
      data: transformedData,
      error: null
    }
  }

  getCacheKey(filters: FilterOptions, userContext: UserContext): string {
    const baseKey = `admin:${userContext.userId}`
    const filterParts = ['all'] // Admin always sees all

    if (filters.careTypes?.length) {
      filterParts.push(`care:${filters.careTypes.sort().join(',')}`)
    }

    if (filters.dateRange) {
      filterParts.push(`date:${filters.dateRange.start}-${filters.dateRange.end}`)
    }

    if (filters.urgencyLevel && filters.urgencyLevel !== 'all') {
      filterParts.push(`urgency:${filters.urgencyLevel}`)
    }

    return `schedules:${baseKey}:${filterParts.join(':')}`
  }

  getCacheTTL(): number {
    // 10 minutes cache for admin queries (less frequent changes expected)
    return 600
  }

  getQueryName(): string {
    return 'AdminFilterStrategy'
  }
}