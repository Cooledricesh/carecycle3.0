'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { FilterStrategy, FilterOptions, UserContext, ScheduleWithDetails } from './types'

export class DoctorFilterStrategy implements FilterStrategy {
  async buildQuery(
    supabase: SupabaseClient<Database>,
    filters: FilterOptions,
    userContext: UserContext
  ): Promise<{ data: ScheduleWithDetails[] | null; error: Error | null }> {
    console.log('[DoctorFilterStrategy] Called with:', {
      userId: userContext.userId,
      role: userContext.role,
      showAll: filters.showAll,
      careTypes: filters.careTypes
    })

    // For calendar views with date range, use the calendar-specific function
    if (filters.dateRange?.start && filters.dateRange?.end) {
      // TODO: Add proper RPC type definition in database.types.ts to remove 'as any'
      const { data: calendarData, error: calendarError } = await (supabase as any).rpc('get_calendar_schedules_filtered', {
        p_start_date: filters.dateRange.start,
        p_end_date: filters.dateRange.end,
        p_user_id: userContext.userId,
        p_show_all: filters.showAll || false,
        p_care_types: filters.careTypes?.length ? filters.careTypes : null
      })

      if (calendarError) {
        console.error('[DoctorFilterStrategy] Calendar RPC error:', calendarError)
      }

      if (!calendarError && calendarData) {
        console.log('[DoctorFilterStrategy] Calendar RPC successful:', {
          dataLength: calendarData.length || 0,
          showAll: filters.showAll,
          userId: userContext.userId,
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

    // Try the regular server-side filtering function
    // TODO: Add proper RPC type definition in database.types.ts to remove 'as any'
    const { data, error } = await (supabase as any).rpc('get_filtered_schedules', {
      p_user_id: userContext.userId,
      p_show_all: filters.showAll || false,
      p_care_types: filters.careTypes?.length ? filters.careTypes : null,
      p_date_start: filters.dateRange?.start || null,
      p_date_end: filters.dateRange?.end || null
    })

    // If RPC succeeded, return the data
    if (!error && data) {
      console.log('[DoctorFilterStrategy] RPC successful:', {
        dataLength: data.length || 0,
        showAll: filters.showAll,
        userId: userContext.userId
      })
      return {
        data: data as ScheduleWithDetails[],
        error: null
      }
    }

    // If RPC failed, fall back to direct query
    console.log('[DoctorFilterStrategy] RPC failed, falling back to direct query:', error?.message)

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
        patients:patient_id (
          id,
          name,
          care_type,
          patient_number,
          doctor_id
        ),
        items:item_id (
          name,
          category
        )
      `)
      .eq('status', 'active')

    // Apply doctor filtering (only show assigned patients unless showAll is true)
    if (!filters.showAll) {
      // First get all schedules, then filter in memory since nested filter syntax is complex
      // We'll filter after fetching the data
    }

    // Apply care type filter if specified
    if (filters.careTypes?.length) {
      query = query.in('patients.care_type', filters.careTypes)
    }

    // Apply date range filter if specified
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
      console.error('[DoctorFilterStrategy] Fallback query error:', queryError)
      return { data: null, error: queryError }
    }

    // Filter schedules based on doctor_id if showAll is false
    let filteredSchedules = schedules || []
    if (!filters.showAll) {
      filteredSchedules = filteredSchedules.filter((s: any) =>
        s.patients?.doctor_id === userContext.userId
      )
      console.log('[DoctorFilterStrategy] Filtered by doctor_id:', {
        originalCount: schedules?.length || 0,
        filteredCount: filteredSchedules.length,
        doctorId: userContext.userId
      })
    }

    // Transform the data to match ScheduleWithDetails format
    const transformedData = filteredSchedules.map((s: Record<string, any>) => ({
      schedule_id: s.id,
      patient_id: s.patient_id,
      patient_name: s.patients?.name || '',
      patient_care_type: s.patients?.care_type || '',
      patient_number: s.patients?.patient_number || '',
      doctor_id: s.patients?.doctor_id || null,
      doctor_name: '',
      item_id: s.item_id,
      item_name: s.items?.name || '',
      item_category: s.items?.category || '',
      next_due_date: s.next_due_date,
      interval_weeks: s.interval_weeks ?? 1,
      priority: s.priority ?? 0,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      notes: s.notes || null
    }))

    console.log('[DoctorFilterStrategy] Fallback query result:', {
      dataLength: transformedData.length
    })

    return {
      data: transformedData,
      error: null
    }
  }

  getCacheKey(filters: FilterOptions, userContext: UserContext): string {
    const baseKey = `doctor:${userContext.userId}`
    const filterParts = []

    if (filters.showAll) {
      filterParts.push('all')
    } else {
      filterParts.push('my')
    }

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
    // Disable cache for now to ensure filter changes are immediately reflected
    return 0
  }

  getQueryName(): string {
    return 'DoctorFilterStrategy'
  }
}