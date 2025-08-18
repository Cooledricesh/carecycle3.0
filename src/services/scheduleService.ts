'use client'

import { createClient } from '@/lib/supabase/client'
import { 
  ScheduleCreateSchema, 
  ScheduleUpdateSchema,
  type ScheduleCreateInput,
  type ScheduleUpdateInput 
} from '@/schemas/schedule'
import type { Schedule, ScheduleWithDetails } from '@/types/schedule'
import { snakeToCamel, camelToSnake } from '@/lib/database-utils'
import { format, addDays } from 'date-fns'

const supabase = createClient()

export const scheduleService = {
  async create(input: ScheduleCreateInput): Promise<Schedule> {
    try {
      const validated = ScheduleCreateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      // Calculate next_due_date from start_date
      const nextDueDate = validated.startDate
      
      const { data, error } = await supabase
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

  async getTodayChecklist(): Promise<ScheduleWithDetails[]> {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          patients!patient_id (*),
          items!item_id (*)
        `)
        .eq('status', 'active')
        .lte('next_due_date', today)
        .order('priority', { ascending: false })
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: snakeToCamel(item.patients),
          item: snakeToCamel(item.items)
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching today checklist:', error)
      throw new Error('오늘 체크리스트 조회에 실패했습니다')
    }
  },

  async getUpcomingSchedules(daysAhead: number = 7): Promise<ScheduleWithDetails[]> {
    try {
      const today = new Date()
      const futureDate = format(addDays(today, daysAhead), 'yyyy-MM-dd')
      const todayStr = format(today, 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          patients!patient_id (*),
          items!item_id (*)
        `)
        .eq('status', 'active')
        .gte('next_due_date', todayStr)
        .lte('next_due_date', futureDate)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: snakeToCamel(item.patients),
          item: snakeToCamel(item.items)
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching upcoming schedules:', error)
      throw new Error('예정된 일정 조회에 실패했습니다')
    }
  },

  async getByPatientId(patientId: string): Promise<ScheduleWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          patients!patient_id (*),
          items!item_id (*)
        `)
        .eq('patient_id', patientId)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: snakeToCamel(item.patients),
          item: snakeToCamel(item.items)
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching patient schedules:', error)
      throw new Error('환자 일정 조회에 실패했습니다')
    }
  },

  async getById(id: string): Promise<ScheduleWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          patients!patient_id (*),
          items!item_id (*)
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
        patient: snakeToCamel(data.patients),
        item: snakeToCamel(data.items)
      } as ScheduleWithDetails
    } catch (error) {
      console.error('Error fetching schedule:', error)
      throw new Error('일정 조회에 실패했습니다')
    }
  },

  async update(id: string, input: ScheduleUpdateInput): Promise<Schedule> {
    try {
      const validated = ScheduleUpdateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      const { data, error } = await supabase
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

  async updateStatus(id: string, status: 'active' | 'paused' | 'completed' | 'cancelled'): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error updating schedule status:', error)
      throw new Error('일정 상태 변경에 실패했습니다')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ status: 'cancelled' })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting schedule:', error)
      throw new Error('일정 삭제에 실패했습니다')
    }
  },

  async getOverdueSchedules(): Promise<ScheduleWithDetails[]> {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          patients!patient_id (*),
          items!item_id (*)
        `)
        .eq('status', 'active')
        .lt('next_due_date', today)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const schedule = snakeToCamel(item) as any
        return {
          ...schedule,
          patient: snakeToCamel(item.patients),
          item: snakeToCamel(item.items)
        } as ScheduleWithDetails
      })
    } catch (error) {
      console.error('Error fetching overdue schedules:', error)
      throw new Error('지연된 일정 조회에 실패했습니다')
    }
  }
}