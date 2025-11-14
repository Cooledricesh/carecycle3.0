'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { FilterStrategy, FilterOptions, UserContext, ScheduleWithDetails } from './types'

export class NurseFilterStrategy implements FilterStrategy {
  async buildQuery(
    supabase: SupabaseClient<Database>,
    filters: FilterOptions,
    userContext: UserContext
  ): Promise<{ data: ScheduleWithDetails[] | null; error: Error | null }> {
    // Nurse defaults to their department_id unless showing all
    // Fallback chain: filters.department_ids → user.departmentId → user.careType (legacy)
    const effectiveCareTypes = filters.showAll
      ? filters.department_ids
      : (filters.department_ids?.length
          ? filters.department_ids
          : (userContext.departmentId
              ? [userContext.departmentId]
              : (userContext.careType ? [userContext.careType] : null)))

    // For calendar views with date range, use the calendar-specific function
    if (filters.dateRange?.start && filters.dateRange?.end) {
      // TODO: Add proper RPC type definition in database.types.ts to remove 'as any'
      const { data: calendarData, error: calendarError } = await (supabase as any).rpc('get_calendar_schedules_filtered', {
        p_start_date: filters.dateRange.start,
        p_end_date: filters.dateRange.end,
        p_user_id: userContext.userId,
        p_show_all: filters.showAll || false,
        p_care_types: effectiveCareTypes?.length ? effectiveCareTypes : null
      })

      if (calendarError) {
        console.error('[NurseFilterStrategy] Calendar RPC error:', calendarError)
      }

      if (!calendarError && calendarData) {
        console.log('[NurseFilterStrategy] Calendar RPC successful:', {
          dataLength: calendarData.length || 0,
          showAll: filters.showAll,
          userId: userContext.userId,
          careType: userContext.careType,
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
          doctor_name: item.doctor_name || '미지정', // RPC returns doctor_name with COALESCE
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
          notes: item.notes, // ✅ FIXED: Use notes from schedules table (not execution_notes)
          execution_notes: item.execution_notes, // Keep execution_notes separate
          injection_dosage: item.injection_dosage,
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
    // TODO: Add proper RPC type definition in database.types.ts to remove 'as any'
    const { data, error } = await (supabase as any).rpc('get_filtered_schedules', {
      p_user_id: userContext.userId,
      p_show_all: filters.showAll || false,
      p_care_types: effectiveCareTypes?.length ? effectiveCareTypes : null,
      p_date_start: filters.dateRange?.start || null,
      p_date_end: filters.dateRange?.end || null
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
        injection_dosage,
        priority,
        created_at,
        updated_at,
        patients!inner (
          name,
          patient_number,
          department_id,
          doctor_id,
          assigned_doctor_name,
          departments (
            name
          ),
          profiles:doctor_id (
            name
          )
        ),
        items!inner (
          name,
          category
        )
      `)
      .eq('status', 'active')

    // Apply organization filter (skip for super_admin who has null organization_id)
    if (userContext.organizationId) {
      query = query.eq('organization_id', userContext.organizationId)
    }

    // Apply department filtering
    // IMPORTANT: patients.department_id is a UUID column
    // Only filter if we have a valid UUID, not a legacy care_type string
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUuid = (value: string) => UUID_REGEX.test(value)

    if (!filters.showAll && userContext.departmentId && isValidUuid(userContext.departmentId)) {
      // User has a valid department UUID
      query = query.eq('patients.department_id', userContext.departmentId)
    } else if (!filters.showAll && userContext.careType) {
      // Legacy care_type string - skip filtering and log warning
      console.warn('[NurseFilterStrategy] User has legacy care_type but no department_id. Skipping department filter.')
    } else if (effectiveCareTypes?.length) {
      // Filter by department IDs only if they are valid UUIDs
      const validUuids = effectiveCareTypes.filter(id => isValidUuid(id))
      if (validUuids.length > 0) {
        query = query.in('patients.department_id', validUuids)
      } else {
        console.warn('[NurseFilterStrategy] effectiveCareTypes contains non-UUID values. Skipping department filter.', effectiveCareTypes)
      }
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

    const transformedData = (schedules || []).map((s: Record<string, any>) => ({
      schedule_id: s.id,
      patient_id: s.patient_id,
      patient_name: s.patients?.name || '',
      patient_care_type: s.patients?.departments?.name || '',
      patient_number: s.patients?.patient_number || '',
      doctor_id: s.patients?.doctor_id || null,
      // COALESCE: registered doctor name -> unregistered doctor name -> fallback
      doctor_name: s.patients?.profiles?.name || s.patients?.assigned_doctor_name || '미지정',
      item_id: s.item_id,
      item_name: s.items?.name || '',
      item_category: s.items?.category || '',
      next_due_date: s.next_due_date,
      interval_weeks: s.interval_weeks || 1,
      priority: s.priority ?? 0,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      notes: s.notes || null,
      injection_dosage: s.injection_dosage ?? null
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

    // Phase 1: department_ids contain care_type values
    if (filters.department_ids?.length) {
      filterParts.push(`deptIds:${filters.department_ids.sort().join(',')}`)
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