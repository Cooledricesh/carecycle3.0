'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { 
  ScheduleCreateSchema, 
  ScheduleUpdateSchema,
  type ScheduleCreateInput,
  type ScheduleUpdateInput 
} from '@/schemas/schedule'
import type { Schedule, ScheduleWithDetails } from '@/types/schedule'
import { toCamelCase as snakeToCamel, toSnakeCase as camelToSnake } from '@/lib/database-utils'
import { format, addDays } from 'date-fns'
import { addWeeks } from '@/lib/utils/date'
import type { Database } from '@/lib/database.types'

export const scheduleService = {
  async create(input: ScheduleCreateInput, supabase?: SupabaseClient<Database>): Promise<Schedule> {
    const client = supabase || createClient()
    try {
      const validated = ScheduleCreateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      // Calculate next_due_date from start_date
      const nextDueDate = validated.startDate
      
      const { data, error } = await (client as any)
        .from('schedules')
        .insert({
          ...snakeData,
          next_due_date: nextDueDate,
          status: 'active'
        })
        .select()
        .single()
      
      if (error) throw error
      return snakeToCamel(data) as Schedule
    } catch (error) {
      console.error('Error creating schedule:', error)
      throw new Error('일정 등록에 실패했습니다')
    }
  },

  async createWithCustomItem(input: {
    patientId: string
    itemName: string
    intervalWeeks: number
    intervalUnit: string
    intervalValue: number
    startDate: string
    nextDueDate: string
    notes?: string | null
  }, supabase?: SupabaseClient<Database>): Promise<Schedule> {
    const client = supabase || createClient()
    try {
      // First, create or find the item
      let itemId: string
      
      // Check if item with this name already exists
      const { data: existingItem } = await client
        .from('items')
        .select('id')
        .eq('name', input.itemName)
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
            name: input.itemName,
            category: '기타',
            description: `${input.intervalWeeks}주 주기`,
            default_interval_weeks: input.intervalWeeks,
            preparation_notes: null
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
      
      // Create the schedule with current user as creator
      const { data: userData } = await client.auth.getUser()
      const userId = userData?.user?.id
      
      const { data, error } = await (client as any)
        .from('schedules')
        .insert({
          patient_id: input.patientId,
          item_id: itemId,
          interval_weeks: input.intervalWeeks,
          start_date: input.startDate,
          next_due_date: input.nextDueDate,
          status: 'active',
          notes: input.notes,
          priority: 0,
          requires_notification: true,
          notification_days_before: 7,
          created_by: userId,
          assigned_nurse_id: userId // Assign to the creator by default
        })
        .select()
        .single()
      
      if (error) {
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
      console.error('Error creating schedule with custom item:', {
        error,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        fullError: JSON.stringify(error)
      })
      throw new Error('일정 등록에 실패했습니다')
    }
  },

  async getTodayChecklist(supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()
    
    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getTodayChecklist] Fetching... (attempt:', retryCount + 1, ')')
        const today = format(new Date(), 'yyyy-MM-dd')
        
        const { data, error } = await client
          .from('schedules')
          .select(`
            *,
            patients (*),
            items (*)
          `)
          .eq('status', 'active')
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
        
        const schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          return {
            ...schedule,
            patient: (item as any).patients ? snakeToCamel((item as any).patients) : null,
            item: (item as any).items ? snakeToCamel((item as any).items) : null
          } as ScheduleWithDetails
        })
        
        console.log(`[scheduleService.getTodayChecklist] Fetched ${schedules.length} schedules`)
        return schedules
      } catch (error) {
        console.error('Error fetching today checklist:', error)
        throw new Error('오늘 체크리스트 조회에 실패했습니다')
      }
    }
    
    return executeQuery()
  },

  async getUpcomingSchedules(daysAhead: number = 7, supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()
    
    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getUpcomingSchedules] Fetching... (attempt:', retryCount + 1, ')')
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
        
        const schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          return {
            ...schedule,
            patient: (item as any).patients ? snakeToCamel((item as any).patients) : null,
            item: (item as any).items ? snakeToCamel((item as any).items) : null
          } as ScheduleWithDetails
        })
        
        console.log(`[scheduleService.getUpcomingSchedules] Fetched ${schedules.length} schedules`)
        return schedules
      } catch (error) {
        console.error('Error fetching upcoming schedules:', error)
        throw new Error('예정된 일정 조회에 실패했습니다')
      }
    }
    
    return executeQuery()
  },

  async getByPatientId(patientId: string, supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails[]> {
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

  async getById(id: string, supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails | null> {
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

  async update(id: string, input: ScheduleUpdateInput, supabase?: SupabaseClient<Database>): Promise<Schedule> {
    const client = supabase || createClient()
    try {
      const validated = ScheduleUpdateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      const { data, error } = await client
        .from('schedules')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return snakeToCamel(data) as Schedule
    } catch (error) {
      console.error('Error updating schedule:', error)
      throw new Error('일정 수정에 실패했습니다')
    }
  },

  async updateStatus(id: string, status: 'active' | 'paused' | 'completed' | 'cancelled', supabase?: SupabaseClient<Database>): Promise<void> {
    const client = supabase || createClient()
    try {
      const { error } = await client
        .from('schedules')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error updating schedule status:', error)
      throw new Error('일정 상태 변경에 실패했습니다')
    }
  },

  async delete(id: string, supabase?: SupabaseClient<Database>): Promise<void> {
    const client = supabase || createClient()
    try {
      const { error } = await client
        .from('schedules')
        .update({ status: 'cancelled' })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting schedule:', error)
      throw new Error('일정 삭제에 실패했습니다')
    }
  },

  async getOverdueSchedules(supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails[]> {
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

  async getAllSchedules(supabase?: SupabaseClient<Database>): Promise<ScheduleWithDetails[]> {
    const client = supabase || createClient()
    
    const executeQuery = async (retryCount = 0): Promise<ScheduleWithDetails[]> => {
      try {
        console.log('[scheduleService.getAllSchedules] Fetching... (attempt:', retryCount + 1, ')')
        
        const { data, error } = await client
          .from('schedules')
          .select(`
            *,
            patients (*),
            items (*)
          `)
          .in('status', ['active', 'paused'])  // Only show active and paused schedules, exclude cancelled and deleted
          .order('next_due_date', { ascending: true })
        
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
        
        const schedules = (data || []).map(item => {
          const schedule = snakeToCamel(item) as any
          return {
            ...schedule,
            patient: (item as any).patients ? snakeToCamel((item as any).patients) : null,
            item: (item as any).items ? snakeToCamel((item as any).items) : null
          } as ScheduleWithDetails
        })
        
        console.log(`[scheduleService.getAllSchedules] Fetched ${schedules.length} schedules`)
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

  async markAsCompleted(scheduleId: string, input: {
    executedDate: string,
    notes?: string,
    executedBy: string
  }, supabase?: SupabaseClient<Database>): Promise<void> {
    const client = supabase || createClient()
    try {
      // 1. 스케줄 정보 조회
      const { data: schedule, error: scheduleError } = await client
        .from('schedules')
        .select('*, items(*)')
        .eq('id', scheduleId)
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
      
      if (updateError) {
        console.error('Schedule update error:', updateError)
        throw updateError
      }
    } catch (error) {
      console.error('Error marking schedule as completed:', error)
      throw new Error('일정 완료 처리에 실패했습니다')
    }
  }
}