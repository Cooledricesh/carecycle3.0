/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Legacy service with complex type issues, needs refactoring
'use client'

import { createClient, type SupabaseClient } from '@/lib/supabase/client'
import {
  ScheduleCreateSchema,
  ScheduleUpdateSchema,
  ScheduleEditSchema,
  ScheduleCreateWithCustomItemSchema,
  type ScheduleCreateInput,
  type ScheduleUpdateInput,
  type ScheduleEditInput,
  type ScheduleCreateWithCustomItemInput
} from '@/schemas/schedule'
import type { Schedule, ScheduleWithDetails } from '@/types/schedule'
import { toCamelCase as snakeToCamel, toSnakeCase as camelToSnake } from '@/lib/database-utils'
import { format, addDays } from 'date-fns'
import { addWeeks } from '@/lib/utils/date'
import type { ScheduleFilter } from '@/lib/filters/filter-types'

export const scheduleService = {
  async create(input: ScheduleCreateInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule> {
    const client = supabase || createClient()
    try {
      const validated = ScheduleCreateSchema.parse(input)
      const snakeData = camelToSnake(validated)

      // Check if there's already an active schedule for this patient-item combination
      const { data: existingSchedule } = await client
        .from('schedules')
        .select('id')
        .eq('patient_id', validated.patientId)
        .eq('item_id', validated.itemId)
        .eq('status', 'active')
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (existingSchedule) {
        // Get item name for better error message
        const { data: itemData } = await client
          .from('items')
          .select('name')
          .eq('id', validated.itemId)
          .single()

        const itemName = itemData?.name || '해당 항목'

        console.error('Duplicate active schedule attempted:', {
          patientId: validated.patientId,
          itemId: validated.itemId
        })
        throw new Error(`이미 해당 환자의 "${itemName}" 스케줄이 활성 상태로 존재합니다. 기존 스케줄을 수정하거나 중지한 후 다시 시도해주세요.`)
      }

      // Calculate next_due_date from start_date
      const nextDueDate = validated.startDate

      const { data, error } = await (client as any)
        .from('schedules')
        .insert({
          ...snakeData,
          next_due_date: nextDueDate,
          status: 'active',
          organization_id: organizationId
        })
        .select()
        .single()

      if (error) {
        // Handle duplicate key error specifically
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          console.error('Duplicate key error:', error)
          throw new Error('이미 동일한 스케줄이 존재합니다. 기존 스케줄을 확인해주세요.')
        }
        throw error
      }
      return snakeToCamel(data) as Schedule
    } catch (error: any) {
      console.error('Error creating schedule:', error)
      // Re-throw if it's already our custom error message
      if (error.message?.includes('이미')) {
        throw error
      }
      throw new Error('일정 등록에 실패했습니다')
    }
  },

  async createWithCustomItem(input: ScheduleCreateWithCustomItemInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule> {
    const client = supabase || createClient()

    // Validate input using Zod schema
    const validationResult = ScheduleCreateWithCustomItemSchema.safeParse(input)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errors}`)
    }

    const validatedInput = validationResult.data

    try {
      // First, create or find the item
      let itemId: string
      
      // Check if item with this name already exists
      const { data: existingItem } = await client
        .from('items')
        .select('id')
        .eq('name', validatedInput.itemName)
        .eq('organization_id', organizationId)
        .maybeSingle()
      
      if (existingItem) {
        itemId = (existingItem as any).id
      } else {
        // Create new item (code is optional, so we generate a unique one)
        const itemCode = `CUSTOM_${Date.now()}`
        const { data: newItem, error: itemError } = await (client as any)
          .from('items')
          .insert({
            code: itemCode,
            name: validatedInput.itemName,
            category: validatedInput.category || 'other', // Use validated category or default to 'other'
            description: `${validatedInput.intervalWeeks}주 주기`,
            default_interval_weeks: validatedInput.intervalWeeks,
            preparation_notes: null,
            organization_id: organizationId
          })
          .select()
          .single()
        
        if (itemError) {
          console.error('Error creating item:', {
            code: itemError.code,
            message: itemError.message,
            details: itemError.details,
            hint: itemError.hint
          })
          throw itemError
        }
        itemId = newItem.id
      }
      
      // Check if there's already an active schedule for this patient-item combination
      const { data: existingSchedule } = await client
        .from('schedules')
        .select('id')
        .eq('patient_id', validatedInput.patientId)
        .eq('item_id', itemId)
        .eq('status', 'active')
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (existingSchedule) {
        // This is expected business logic validation, not an error
        // Log only in development for debugging if needed
        if (process.env.NODE_ENV === 'development') {
          console.log('Duplicate schedule validation:', {
            patientId: validatedInput.patientId,
            itemId: itemId,
            itemName: validatedInput.itemName
          })
        }
        throw new Error(`이미 해당 환자의 "${validatedInput.itemName}" 스케줄이 활성 상태로 존재합니다. 기존 스케줄을 수정하거나 중지한 후 다시 시도해주세요.`)
      }

      // Create the schedule with current user as creator
      const { data: userData } = await client.auth.getUser()
      const userId = userData?.user?.id

      const { data, error } = await (client as any)
        .from('schedules')
        .insert({
          patient_id: validatedInput.patientId,
          item_id: itemId,
          interval_weeks: validatedInput.intervalWeeks,
          start_date: validatedInput.startDate,
          next_due_date: validatedInput.nextDueDate,
          status: 'active',
          notes: validatedInput.notes,
          priority: 0,
          requires_notification: true,
          notification_days_before: validatedInput.notificationDaysBefore ?? 7, // Use validated value or default to 7
          created_by: userId,
          assigned_nurse_id: userId, // Assign to the creator by default
          organization_id: organizationId
        })
        .select()
        .single()

      if (error) {
        // Handle duplicate key error specifically
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          console.error('Duplicate key error:', error)
          throw new Error('이미 동일한 스케줄이 존재합니다. 기존 스케줄을 확인해주세요.')
        }

        console.error('Database error creating schedule:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw error
      }
      return snakeToCamel(data) as Schedule
    } catch (error: any) {
      // Only log actual system errors, not business validation
      const isBusinessValidation = error instanceof Error &&
        (error.message.includes('이미 해당 환자의') ||
         error.message.includes('이미 동일한 스케줄이 존재'))

      if (!isBusinessValidation) {
        console.error('Error creating schedule with custom item:', {
          error,
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint
        })
      }

      // Preserve the original error message for better UX
      if (error instanceof Error) {
        throw error
      }
      throw new Error('일정 등록에 실패했습니다')
    }
  },

  async getTodayChecklist(organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()

    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getTodayChecklist] Fetching with filters:', filters, '(attempt:', retryCount + 1, ')')
        const today = format(new Date(), 'yyyy-MM-dd')

        const { data, error } = await client
          .from('schedules')
          .select(`
            *,
            patients (*),
            items (*)
          `)
          .eq('status', 'active')
          .eq('organization_id', organizationId)
          .lte('next_due_date', today)
          .order('priority', { ascending: false })
          .order('next_due_date', { ascending: true })

        if (error) {
          console.error('[scheduleService.getTodayChecklist] Error:', error)

          // Auth error - refresh token and retry
          if ((error.message?.includes('JWT') || error.message?.includes('token') || error.code === 'PGRST301') && retryCount === 0) {
            console.log('[scheduleService] Auth error, refreshing token...')
            const { error: refreshError } = await client.auth.refreshSession()
            if (!refreshError) {
              return executeQuery(retryCount + 1)
            }
          }
          throw error
        }

        let schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          const patients = (item as any).patients
          const items = (item as any).items

          return {
            ...schedule,
            // Explicit schedule_id mapping (ScheduleWithDetails expects snake_case)
            schedule_id: item.id,
            // Add flat fields for UI compatibility (matching scheduleServiceEnhanced pattern)
            patient_name: patients?.name || '',
            patient_care_type: patients?.care_type || '',
            patient_number: patients?.patient_number || '',
            doctor_id: patients?.doctor_id || null,
            doctor_name: patients?.doctor_name || '',
            item_name: items?.name || '',
            item_category: items?.category || '',
            // Keep nested objects for backward compatibility
            patient: patients ? snakeToCamel(patients) : null,
            item: items ? snakeToCamel(items) : null
          } as ScheduleWithDetails
        })

        // Apply client-side filters for nested patient data
        if (filters) {
          // Filter by care types
          if (filters.careTypes && filters.careTypes.length > 0) {
            schedules = schedules.filter(schedule => {
              const careType = schedule.patient_care_type || (schedule as any).patient?.careType
              return careType && filters.careTypes.includes(careType as any)
            })
          }

          // Filter by doctor (for "my patients" view)
          if (filters.doctorId) {
            schedules = schedules.filter(schedule => {
              // Access doctor_id from the flattened schedule or from nested patient
              const doctorId = schedule.doctor_id || (schedule as any).patient?.doctorId
              return doctorId === filters.doctorId
            })
          }
        }

        console.log(`[scheduleService.getTodayChecklist] Fetched ${schedules.length} schedules (after filters)`)
        return schedules
      } catch (error) {
        console.error('Error fetching today checklist:', error)
        throw new Error('오늘 체크리스트 조회에 실패했습니다')
      }
    }
    
    return executeQuery()
  },

  async getUpcomingSchedules(daysAhead: number = 7, organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()

    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getUpcomingSchedules] Fetching with filters:', filters, '(attempt:', retryCount + 1, ')')
        const today = new Date()
        const futureDate = format(addDays(today, daysAhead), 'yyyy-MM-dd')
        // Include schedules from 7 days before their due date
        const pastDate = format(addDays(today, -7), 'yyyy-MM-dd')

        const { data, error } = await client
          .from('schedules')
          .select(`
            *,
            patients (*),
            items (*)
          `)
          .eq('status', 'active')
          .eq('organization_id', organizationId)
          .gte('next_due_date', pastDate)
          .lte('next_due_date', futureDate)
        .order('next_due_date', { ascending: true })

        if (error) {
          console.error('[scheduleService.getUpcomingSchedules] Error:', error)

          // Auth error - refresh token and retry
          if ((error.message?.includes('JWT') || error.message?.includes('token') || error.code === 'PGRST301') && retryCount === 0) {
            console.log('[scheduleService] Auth error, refreshing token...')
            const { error: refreshError } = await client.auth.refreshSession()
            if (!refreshError) {
              return executeQuery(retryCount + 1)
            }
          }
          throw error
        }

        let schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          const patients = (item as any).patients
          const items = (item as any).items

          return {
            ...schedule,
            // Explicit schedule_id mapping (ScheduleWithDetails expects snake_case)
            schedule_id: item.id,
            // Add flat fields for UI compatibility (matching scheduleServiceEnhanced pattern)
            patient_name: patients?.name || '',
            patient_care_type: patients?.care_type || '',
            patient_number: patients?.patient_number || '',
            doctor_id: patients?.doctor_id || null,
            doctor_name: patients?.doctor_name || '',
            item_name: items?.name || '',
            item_category: items?.category || '',
            // Keep nested objects for backward compatibility
            patient: patients ? snakeToCamel(patients) : null,
            item: items ? snakeToCamel(items) : null
          } as ScheduleWithDetails
        })

        // Apply client-side filters for nested patient data
        if (filters) {
          // Filter by care types
          if (filters.careTypes && filters.careTypes.length > 0) {
            schedules = schedules.filter(schedule => {
              const careType = schedule.patient_care_type || (schedule as any).patient?.careType
              return careType && filters.careTypes.includes(careType as any)
            })
          }

          // Filter by doctor (for "my patients" view)
          if (filters.doctorId) {
            schedules = schedules.filter(schedule => {
              // Access doctor_id from the flattened schedule or from nested patient
              const doctorId = schedule.doctor_id || (schedule as any).patient?.doctorId
              return doctorId === filters.doctorId
            })
          }
        }

        console.log(`[scheduleService.getUpcomingSchedules] Fetched ${schedules.length} schedules (after filters)`)
        return schedules
      } catch (error) {
        console.error('Error fetching upcoming schedules:', error)
        throw new Error('예정된 일정 조회에 실패했습니다')
      }
    }
    
    return executeQuery()
  },

  async getByPatientId(patientId: string, organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()
    try {
      const { data, error } = await client
        .from('schedules')
        .select(`
          *,
          patients (*),
          items (*)
        `)
        .eq('patient_id', patientId)
        .eq('organization_id', organizationId)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: (item as any).patients ? snakeToCamel((item as any).patients) : null,
          item: (item as any).items ? snakeToCamel((item as any).items) : null
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching patient schedules:', error)
      throw new Error('환자 일정 조회에 실패했습니다')
    }
  },

  async getById(id: string, organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails | null> {
    const client = supabase || createClient()
    try {
      const { data, error } = await client
        .from('schedules')
        .select(`
          *,
          patients (*),
          items (*)
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      
      const schedule = snakeToCamel(data) as any
      return {
        ...schedule,
        patient: snakeToCamel((data as any).patients),
        item: snakeToCamel((data as any).items)
      } as ScheduleWithDetails
    } catch (error) {
      console.error('Error fetching schedule:', error)
      throw new Error('일정 조회에 실패했습니다')
    }
  },

  async update(id: string, input: ScheduleUpdateInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule> {
    const client = supabase || createClient()
    try {
      const validated = ScheduleUpdateSchema.parse(input)
      const snakeData = camelToSnake(validated)

      const { data, error } = await client
        .from('schedules')
        .update(snakeData)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single()
      
      if (error) throw error
      return snakeToCamel(data) as Schedule
    } catch (error) {
      console.error('Error updating schedule:', error)
      throw new Error('일정 수정에 실패했습니다')
    }
  },

  async updateStatus(id: string, status: 'active' | 'paused' | 'completed' | 'cancelled', organizationId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase || createClient()

    // Use the new ScheduleStateManager for pause/resume transitions
    if (status === 'paused' || status === 'active') {
      const { ScheduleStateManager } = await import('@/lib/schedule-management/schedule-state-manager')
      const stateManager = new ScheduleStateManager(client)

      // Get current schedule to check its status
      const { data: schedule, error: fetchError } = await client
        .from('schedules')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single()

      if (fetchError || !schedule) {
        throw new Error('스케줄을 찾을 수 없습니다')
      }

      // Handle pause
      if (status === 'paused' && schedule.status === 'active') {
        await stateManager.pauseSchedule(id)
        return
      }

      // Handle resume - requires additional options
      if (status === 'active' && schedule.status === 'paused') {
        // For backward compatibility, use default resume strategy
        await stateManager.resumeSchedule(id, {
          strategy: 'next_cycle',
          handleMissed: 'skip'
        })
        return
      }
    }

    // For other status changes, use the original logic
    try {
      const { error } = await client
        .from('schedules')
        .update({ status })
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating schedule status:', error)
      throw new Error('일정 상태 변경에 실패했습니다')
    }
  },

  // New method for advanced pause/resume with options
  async pauseSchedule(id: string, organizationId: string, options?: { reason?: string; notifyAssignedNurse?: boolean }, supabase?: SupabaseClient): Promise<void> {
    const client = supabase || createClient()

    // Validate ownership
    const schedule = await this.getById(id, organizationId, client)
    if (!schedule) throw new Error('스케줄을 찾을 수 없습니다')

    const { ScheduleStateManager } = await import('@/lib/schedule-management/schedule-state-manager')
    const stateManager = new ScheduleStateManager(client)

    await stateManager.pauseSchedule(id, options)
  },

  async resumeSchedule(
    id: string,
    organizationId: string,
    options: {
      strategy: 'immediate' | 'next_cycle' | 'custom'
      customDate?: Date
      handleMissed?: 'skip' | 'catch_up' | 'mark_overdue'
    },
    supabase?: SupabaseClient
  ): Promise<void> {
    const client = supabase || createClient()

    // Validate ownership
    const schedule = await this.getById(id, organizationId, client)
    if (!schedule) throw new Error('스케줄을 찾을 수 없습니다')

    const { ScheduleStateManager } = await import('@/lib/schedule-management/schedule-state-manager')
    const stateManager = new ScheduleStateManager(client)

    await stateManager.resumeSchedule(id, options)
  },

  async delete(id: string, organizationId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase || createClient()
    try {
      const { error } = await client
        .from('schedules')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('organization_id', organizationId)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting schedule:', error)
      throw new Error('일정 삭제에 실패했습니다')
    }
  },

  async getOverdueSchedules(organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      const { data, error } = await client
        .from('schedules')
        .select(`
          *,
          patients (*),
          items (*)
        `)
        .eq('status', 'active')
        .eq('organization_id', organizationId)
        .lt('next_due_date', today)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: (item as any).patients ? snakeToCamel((item as any).patients) : null,
          item: (item as any).items ? snakeToCamel((item as any).items) : null
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching overdue schedules:', error)
      throw new Error('지연된 일정 조회에 실패했습니다')
    }
  },

  async getAllSchedules(organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()

    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getAllSchedules] Fetching with filters:', filters, '(attempt:', retryCount + 1, ')')

        let query = client
          .from('schedules')
          .select(`
            *,
            patients (*),
            items (*)
          `)
          .in('status', ['active', 'paused'])  // Only show active and paused schedules, exclude cancelled and deleted
          .eq('organization_id', organizationId)

        // Apply filters
        if (filters) {
          // Filter by care types - need to filter through patients
          // Note: We can't directly filter on nested fields, so we'll filter in memory
          // For optimal performance, this could be replaced with a view or function in the database
        }

        query = query.order('next_due_date', { ascending: true })

        const { data, error } = await query
        
        if (error) {
          console.error('[scheduleService.getAllSchedules] Error:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error)
          })
          
          // Auth error - refresh token and retry
          if ((error.message?.includes('JWT') || error.message?.includes('token') || error.code === 'PGRST301') && retryCount === 0) {
            console.log('[scheduleService] Auth error, refreshing token...')
            const { error: refreshError } = await client.auth.refreshSession()
            if (!refreshError) {
              return executeQuery(retryCount + 1)
            }
          }
          throw error
        }

        let schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          const patients = (item as any).patients
          const items = (item as any).items

          return {
            ...schedule,
            // Explicit schedule_id mapping (ScheduleWithDetails expects snake_case)
            schedule_id: item.id,
            // Add flat fields for UI compatibility (matching scheduleServiceEnhanced pattern)
            patient_name: patients?.name || '',
            patient_care_type: patients?.care_type || '',
            patient_number: patients?.patient_number || '',
            doctor_id: patients?.doctor_id || null,
            doctor_name: patients?.doctor_name || '',
            item_name: items?.name || '',
            item_category: items?.category || '',
            // Keep nested objects for backward compatibility
            patient: patients ? snakeToCamel(patients) : null,
            item: items ? snakeToCamel(items) : null
          } as ScheduleWithDetails
        })

        // Apply client-side filters for nested patient data
        if (filters) {
          // Filter by care types
          if (filters.careTypes && filters.careTypes.length > 0) {
            schedules = schedules.filter(schedule => {
              const careType = schedule.patient_care_type || (schedule as any).patient?.careType
              return careType && filters.careTypes.includes(careType as any)
            })
          }

          // Filter by department
          if (filters.department) {
            schedules = schedules.filter(schedule => {
              const department = (schedule as any).patient?.department
              return department === filters.department
            })
          }

          // Filter by date range
          if (filters.dateRange) {
            schedules = schedules.filter(schedule => {
              if (!schedule.next_due_date) return false
              return schedule.next_due_date >= filters.dateRange!.start &&
                     schedule.next_due_date <= filters.dateRange!.end
            })
          }

          // Note: Doctor filter will be applied when doctor field is added to patient table
          // if (filters.doctorId) {
          //   schedules = schedules.filter(schedule =>
          //     schedule.patient?.doctorId === filters.doctorId
          //   )
          // }
        }

        console.log(`[scheduleService.getAllSchedules] Fetched ${schedules.length} schedules (after filters)`)
        return schedules
        
      } catch (error) {
        console.error('Error fetching all schedules:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          details: JSON.stringify(error)
        })
        throw new Error('전체 일정 조회에 실패했습니다')
      }
    }
    
    return executeQuery()
  },

  async editSchedule(scheduleId: string, input: ScheduleEditInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule> {
    const client = supabase || createClient()

    // Development-only logging without PHI
    if (process.env.NODE_ENV === 'development') {
      console.log('[editSchedule] Starting:', {
        scheduleId,
        inputFields: input ? Object.keys(input) : [],
        hasSupabaseClient: !!supabase
      })
    }

    try {
      const validated = ScheduleEditSchema.parse(input)

      // First, get the current schedule to check start_date
      if (process.env.NODE_ENV === 'development') {
        console.log('[editSchedule] Fetching schedule with ID:', scheduleId)
      }
      const { data: currentSchedule, error: fetchError } = await client
        .from('schedules')
        .select('start_date')
        .eq('id', scheduleId)
        .eq('organization_id', organizationId)
        .single()

      if (fetchError) {
        console.error('[editSchedule] Error fetching schedule:', {
          error: fetchError.message,
          code: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint,
          scheduleId
        })
        throw fetchError
      }

      if (!currentSchedule) {
        throw new Error('스케줄을 찾을 수 없습니다')
      }

      // Validate next_due_date against start_date
      if (validated.nextDueDate) {
        const startDate = new Date(currentSchedule.start_date)
        const nextDueDate = new Date(validated.nextDueDate)

        // Format dates for better error message
        const formatDate = (date: Date) => {
          return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
        }

        if (nextDueDate < startDate) {
          const errorMsg = `다음 예정일(${formatDate(nextDueDate)})은 시작일(${formatDate(startDate)}) 이후여야 합니다`
          console.error('Date validation error:', {
            nextDueDate: validated.nextDueDate,
            startDate: currentSchedule.start_date,
            message: errorMsg
          })
          throw new Error(errorMsg)
        }
      }

      // Create or find the item with the new name
      let itemId: string

      // Check if item with this name already exists
      const { data: existingItem } = await client
        .from('items')
        .select('id')
        .eq('name', validated.itemName)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (existingItem) {
        itemId = (existingItem as any).id
      } else {
        // Create new item
        const itemCode = `CUSTOM_${Date.now()}`
        const { data: newItem, error: itemError } = await (client as any)
          .from('items')
          .insert({
            code: itemCode,
            name: validated.itemName,
            category: 'other',
            description: `${validated.intervalWeeks}주 주기`,
            default_interval_weeks: validated.intervalWeeks,
            preparation_notes: null,
            organization_id: organizationId
          })
          .select()
          .single()

        if (itemError) {
          console.error('Error creating item:', itemError)
          throw itemError
        }
        itemId = newItem.id
      }

      // Update the schedule with new values
      const updateData: any = {
        item_id: itemId,
        interval_weeks: validated.intervalWeeks,
        notes: validated.notes
      }

      // Add next_due_date if provided (already validated above)
      if (validated.nextDueDate) {
        updateData.next_due_date = validated.nextDueDate
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[editSchedule] Updating schedule:', {
          scheduleId,
          fieldsToUpdate: Object.keys(updateData),
          hasItemId: !!itemId
        })
      }

      const { data, error } = await client
        .from('schedules')
        .update(updateData)
        .eq('id', scheduleId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (process.env.NODE_ENV === 'development') {
        console.log('[editSchedule] Update result:', {
          success: !error,
          hasData: !!data,
          errorCode: error?.code || null
        })
      }
      
      if (error) {
        // Handle specific database constraint errors
        if ((error as any).code === '23514' && (error as any).message?.includes('check_next_due_date')) {
          console.error('Database constraint violation:', error)
          throw new Error('다음 예정일은 시작일 이후여야 합니다. 날짜를 다시 확인해주세요.')
        }
        throw error
      }
      return snakeToCamel(data) as Schedule
    } catch (error) {
      console.error('[editSchedule] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        scheduleId
        // Note: input removed to prevent PHI exposure
      })

      // If it's already our custom error message, pass it through
      if (error instanceof Error && error.message.includes('다음 예정일')) {
        throw error
      }

      // Otherwise, throw a generic error
      throw new Error('스케줄 수정에 실패했습니다')
    }
  },

  async markAsCompleted(scheduleId: string, input: {
    executedDate: string,
    notes?: string,
    executedBy: string
  }, organizationId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase || createClient()
    try {
      // 1. 스케줄 정보 조회
      const { data: schedule, error: scheduleError } = await client
        .from('schedules')
        .select('*, items(*)')
        .eq('id', scheduleId)
        .eq('organization_id', organizationId)
        .single()

      if (scheduleError) throw scheduleError
      if (!schedule) throw new Error('스케줄을 찾을 수 없습니다')

      // 2. schedule_executions 테이블에 실행 기록 추가 (UPSERT 함수 사용)
      // RPC 함수가 존재하는지 먼저 확인하고, 없으면 기존 방식 사용
      try {
        // 새로운 UPSERT 함수 사용 시도
        const { error: rpcError } = await client
          .rpc('complete_schedule_execution', {
            p_schedule_id: scheduleId,
            p_planned_date: schedule.next_due_date,
            p_executed_date: input.executedDate,
            p_executed_by: input.executedBy,
            p_notes: input.notes || null
          })

        if (rpcError) {
          // RPC 함수가 없으면 기존 방식으로 fallback
          if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
            console.log('RPC function not found, using fallback method')

            // 기존 INSERT 방식 (중복 시 실패할 수 있음)
            const { error: executionError } = await client
              .from('schedule_executions')
              .insert({
                schedule_id: scheduleId,
                planned_date: schedule.next_due_date,
                executed_date: input.executedDate,
                executed_time: format(new Date(), 'HH:mm:ss'),
                status: 'completed',
                executed_by: input.executedBy,
                notes: input.notes || null
              })

            if (executionError) {
              // 중복 키 에러인 경우 UPDATE 시도
              if (executionError.code === '23505') {
                const { error: updateError } = await client
                  .from('schedule_executions')
                  .update({
                    executed_date: input.executedDate,
                    executed_time: format(new Date(), 'HH:mm:ss'),
                    status: 'completed',
                    executed_by: input.executedBy,
                    notes: input.notes || null,
                    updated_at: new Date().toISOString()
                  })
                  .eq('schedule_id', scheduleId)
                  .eq('planned_date', schedule.next_due_date)

                if (updateError) {
                  console.error('Execution update error:', updateError)
                  throw updateError
                }
              } else {
                console.error('Execution insert error:', {
                  code: executionError.code,
                  message: executionError.message,
                  details: executionError.details,
                  hint: executionError.hint,
                  error: executionError
                })
                throw executionError
              }
            }
          } else {
            console.error('RPC execution error:', rpcError)
            throw rpcError
          }
        }
      } catch (error: any) {
        console.error('Failed to complete schedule execution:', {
          message: error?.message || 'Unknown error',
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          fullError: error
        })
        throw error
      }

      // 3. 다음 예정일 계산 (실행일 기준으로, 주 단위)
      const executedDate = new Date(input.executedDate)
      const nextDueDate = addWeeks(executedDate, schedule.interval_weeks || 0)

      if (!nextDueDate) {
        throw new Error('다음 예정일 계산에 실패했습니다')
      }

      // 4. schedules 테이블의 next_due_date와 last_executed_date 업데이트
      const { error: updateError } = await client
        .from('schedules')
        .update({
          next_due_date: format(nextDueDate, 'yyyy-MM-dd'),
          last_executed_date: input.executedDate
        })
        .eq('id', scheduleId)
        .eq('organization_id', organizationId)

      if (updateError) {
        console.error('Schedule update error:', updateError)
        throw updateError
      }
    } catch (error) {
      console.error('Error marking schedule as completed:', error)
      throw new Error('일정 완료 처리에 실패했습니다')
    }
  },

  async getCalendarSchedules(startDate: string, endDate: string, organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()

    try {
      // Use the new database function for optimized calendar queries
      const { data, error } = await client.rpc('get_calendar_schedules', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_organization_id: organizationId,
        p_user_id: null // Can be enhanced to pass user ID for role-based filtering
      })

      if (error) {
        console.error('Error fetching calendar schedules:', error)
        throw error
      }

      // Transform the data to ScheduleWithDetails format
      let schedules = (data || []).map((item: any) => {
        const schedule = {
          id: item.schedule_id,
          schedule_id: item.schedule_id,
          patient_id: item.patient_id,
          patient_care_type: item.care_type ?? null,
          patient_number: item.patient_number ?? '',
          doctor_id: item.doctor_id ?? null,
          doctor_name: item.doctor_name ?? '',
          item_id: item.item_id,
          patient_name: item.patient_name,
          item_name: item.item_name,
          item_category: item.item_category,
          interval_weeks: item.interval_weeks,
          priority: item.priority,
          next_due_date: item.display_date,
          status: item.schedule_status,
          display_type: item.display_type,
          execution_id: item.execution_id,
          executed_by: item.executed_by,
          notes: item.execution_notes,
          patient: {
            id: item.patient_id,
            name: item.patient_name,
            careType: item.care_type ?? null
          },
          item: {
            id: item.item_id,
            name: item.item_name,
            category: item.item_category
          }
        } as any

        return schedule as ScheduleWithDetails
      })

      // Apply client-side filters if provided
      if (filters) {
        // Filter by care types
        if (filters.careTypes && filters.careTypes.length > 0) {
          schedules = schedules.filter((schedule: any) => {
            const careType = schedule.patient_care_type || (schedule as any).patient?.careType
            return careType && filters.careTypes.includes(careType as any)
          })
        }

        // Filter by doctor
        if (filters.doctorId) {
          schedules = schedules.filter((schedule: any) => {
            const doctorId = schedule.doctor_id || (schedule as any).patient?.doctorId
            return doctorId === filters.doctorId
          })
        }
      }

      return schedules
    } catch (error) {
      console.error('Error fetching calendar schedules:', error)
      throw new Error('캘린더 일정 조회에 실패했습니다')
    }
  }
}