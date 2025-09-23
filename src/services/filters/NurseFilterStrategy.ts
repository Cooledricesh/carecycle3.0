'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { FilterStrategy, FilterOptions, UserContext, ScheduleWithDetails } from './types'

export class NurseFilterStrategy implements FilterStrategy {
  async buildQuery(
    supabase: SupabaseClient<Database>,
    filters: FilterOptions,
    userContext: UserContext
  ): Promise<{ data: ScheduleWithDetails[] | null; error: any }> {
    // Nurse defaults to their care_type unless showing all
    const effectiveCareTypes = filters.showAll
      ? filters.careTypes
      : (filters.careTypes?.length ? filters.careTypes : (userContext.careType ? [userContext.careType] : null))

    // Try RPC first
    const { data, error } = await supabase.rpc('get_filtered_schedules', {
      p_user_id: userContext.userId,
      p_show_all: filters.showAll || false,
      p_care_types: effectiveCareTypes?.length ? effectiveCareTypes : null,
      p_date_start: filters.dateRange?.start || null,
      p_date_end: filters.dateRange?.end || null,
      p_urgency_level: filters.urgencyLevel && filters.urgencyLevel !== 'all' ? filters.urgencyLevel : null
    })

    if (!error && data) {
      console.log('[NurseFilterStrategy] RPC successful:', data.length, 'items')
      return {
        data: data as ScheduleWithDetails[],
        error: null
      }
    }

    // Fallback to direct query
    console.log('[NurseFilterStrategy] RPC failed, using fallback:', error?.message)

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
      .eq('status', 'active')

    // Apply care type filtering
    if (!filters.showAll && userContext.careType) {
      query = query.eq('patients.care_type', userContext.careType)
    } else if (effectiveCareTypes?.length) {
      query = query.in('patients.care_type', effectiveCareTypes)
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
      console.error('[NurseFilterStrategy] Fallback error:', queryError)
      return { data: null, error: queryError }
    }

    const transformedData = (schedules || []).map(s => ({
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

    console.log('[NurseFilterStrategy] Fallback result:', transformedData.length, 'items')

    return {
      data: transformedData,
      error: null
    }
  }

  getCacheKey(filters: FilterOptions, userContext: UserContext): string {
    const baseKey = `nurse:${userContext.userId}`
    const filterParts = []

    if (filters.showAll) {
      filterParts.push('all')
    } else {
      filterParts.push(`dept:${userContext.careType || 'none'}`)
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
    // 5 minutes cache for nurse queries
    return 300
  }

  getQueryName(): string {
    return 'NurseFilterStrategy'
  }
}