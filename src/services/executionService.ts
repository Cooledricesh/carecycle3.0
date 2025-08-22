'use client'

import { createClient } from '@/lib/supabase/client'
import { 
  ExecutionCreateSchema, 
  ExecutionUpdateSchema,
  type ExecutionCreateInput,
  type ExecutionUpdateInput 
} from '@/schemas/execution'
import type { ScheduleExecution, ExecutionWithRelations } from '@/types/execution'
import { toCamelCase, toSnakeCase } from '@/lib/database-utils'
import { format } from 'date-fns'

const supabase = createClient()

export const executionService = {
  async markAsCompleted(scheduleId: string, executedDate?: string): Promise<ScheduleExecution> {
    try {
      const date = executedDate || format(new Date(), 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('schedule_executions')
        .insert({
          schedule_id: scheduleId,
          planned_date: date,
          executed_date: date,
          executed_time: format(new Date(), 'HH:mm:ss'),
          status: 'completed'
        })
        .select()
        .single()
      
      if (error) {
        // Handle unique constraint violation (already executed today)
        if (error.code === '23505') {
          throw new Error('오늘 이미 실행 완료된 일정입니다')
        }
        throw error
      }
      
      return toCamelCase(data) as ScheduleExecution
    } catch (error) {
      console.error('Error marking execution:', error)
      throw error instanceof Error ? error : new Error('실행 기록 생성에 실패했습니다')
    }
  },

  async markAsSkipped(scheduleId: string, plannedDate: string, reason?: string): Promise<ScheduleExecution> {
    try {
      const { data, error } = await supabase
        .from('schedule_executions')
        .insert({
          schedule_id: scheduleId,
          planned_date: plannedDate,
          status: 'skipped',
          skipped_reason: reason
        })
        .select()
        .single()
      
      if (error) throw error
      return toCamelCase(data) as ScheduleExecution
    } catch (error) {
      console.error('Error marking as skipped:', error)
      throw new Error('건너뛰기 처리에 실패했습니다')
    }
  },

  async getByScheduleId(scheduleId: string): Promise<ScheduleExecution[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_executions')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('planned_date', { ascending: false })
      
      if (error) throw error
      return (data || []).map(item => toCamelCase(item) as ScheduleExecution)
    } catch (error) {
      console.error('Error fetching executions:', error)
      throw new Error('실행 기록 조회에 실패했습니다')
    }
  },

  async getByDateRange(startDate: string, endDate: string): Promise<ExecutionWithRelations[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_executions')
        .select(`
          *,
          schedules!schedule_id (
            *,
            patients!patient_id (*),
            items!item_id (*)
          )
        `)
        .gte('planned_date', startDate)
        .lte('planned_date', endDate)
        .order('planned_date', { ascending: false })
      
      if (error) throw error
      
      return (data || []).map(item => {
        const execution = toCamelCase(item) as any
        const schedule = toCamelCase(item.schedules) as any
        
        return {
          ...execution,
          schedule: {
            ...schedule,
            patient: toCamelCase(item.schedules.patients),
            item: toCamelCase(item.schedules.items)
          }
        } as ExecutionWithRelations
      })
    } catch (error) {
      console.error('Error fetching executions by date:', error)
      throw new Error('날짜별 실행 기록 조회에 실패했습니다')
    }
  },

  async getTodayExecutions(): Promise<ExecutionWithRelations[]> {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      return await this.getByDateRange(today, today)
    } catch (error) {
      console.error('Error fetching today executions:', error)
      throw new Error('오늘 실행 기록 조회에 실패했습니다')
    }
  },

  async update(id: string, input: ExecutionUpdateInput): Promise<ScheduleExecution> {
    try {
      const validated = ExecutionUpdateSchema.parse(input)
      const snakeData = toSnakeCase(validated)
      
      const { data, error } = await supabase
        .from('schedule_executions')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return toCamelCase(data) as ScheduleExecution
    } catch (error) {
      console.error('Error updating execution:', error)
      throw new Error('실행 기록 수정에 실패했습니다')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedule_executions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting execution:', error)
      throw new Error('실행 기록 삭제에 실패했습니다')
    }
  },

  async checkExecutionStatus(scheduleId: string, date: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('schedule_executions')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('planned_date', date)
        .eq('status', 'completed')
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return !!data
    } catch (error) {
      console.error('Error checking execution status:', error)
      return false
    }
  },

  async getStatsByDateRange(startDate: string, endDate: string): Promise<{
    total: number
    completed: number
    skipped: number
    overdue: number
  }> {
    try {
      const { data, error } = await supabase
        .from('schedule_executions')
        .select('status')
        .gte('planned_date', startDate)
        .lte('planned_date', endDate)
      
      if (error) throw error
      
      const stats = {
        total: data?.length || 0,
        completed: 0,
        skipped: 0,
        overdue: 0
      }
      
      data?.forEach(item => {
        switch (item.status) {
          case 'completed':
            stats.completed++
            break
          case 'skipped':
            stats.skipped++
            break
          case 'overdue':
            stats.overdue++
            break
        }
      })
      
      return stats
    } catch (error) {
      console.error('Error fetching execution stats:', error)
      throw new Error('실행 통계 조회에 실패했습니다')
    }
  }
}