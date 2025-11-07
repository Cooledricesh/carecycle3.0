'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { ScheduleStateManager, type PauseOptions, type ResumeOptions } from '@/lib/schedule-management/schedule-state-manager'
import { ScheduleStateValidator } from '@/lib/schedule-management/schedule-state-validator'
import type { Schedule } from '@/types/schedule'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'

export interface UseScheduleStateReturn {
  isPausing: boolean
  isResuming: boolean
  pauseSchedule: (id: string, options?: PauseOptions) => Promise<void>
  resumeSchedule: (id: string, options: ResumeOptions) => Promise<void>
  canPause: boolean
  canResume: boolean
  pauseDuration: number | null
  suggestedStrategy: 'immediate' | 'next_cycle' | 'custom'
}

/**
 * 스케줄 상태 관리를 위한 커스텀 훅
 * 일시정지/재개 기능과 관련 상태를 제공합니다.
 */
export function useScheduleState(schedule: Schedule | null): UseScheduleStateReturn {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isPausing, setIsPausing] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  // Initialize managers
  const stateManager = new ScheduleStateManager()
  const validator = new ScheduleStateValidator()

  // Normalize schedule from camelCase to snake_case for ScheduleStateManager
  // The manager expects database field names (snake_case) but our types use camelCase
  const normalizeScheduleForManager = (schedule: Schedule): any => {
    return {
      ...schedule,
      // Map camelCase to snake_case for fields the manager needs
      updated_at: schedule.updatedAt,
      created_at: schedule.createdAt,
      patient_id: schedule.patientId,
      item_id: schedule.itemId,
      interval_weeks: schedule.intervalWeeks,
      start_date: schedule.startDate,
      end_date: schedule.endDate,
      last_executed_date: schedule.lastExecutedDate,
      next_due_date: schedule.nextDueDate,
      assigned_nurse_id: schedule.assignedNurseId,
      requires_notification: schedule.requiresNotification,
      notification_days_before: schedule.notificationDaysBefore,
      created_by: schedule.createdBy,
    }
  }

  // Calculate states
  const canPause = schedule ? validator.canPause(schedule) : false
  const canResume = schedule ? validator.canResume(schedule) : false

  // Use normalized schedule for methods that need snake_case fields
  const pauseDuration = schedule ? stateManager.getPauseDuration(normalizeScheduleForManager(schedule)) : null
  const suggestedStrategy = schedule ? stateManager.suggestResumeStrategy(normalizeScheduleForManager(schedule)) : 'next_cycle'

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async ({ id, options }: { id: string; options?: PauseOptions }) => {
      setIsPausing(true)
      await stateManager.pauseSchedule(id, options)
    },
    onSuccess: (_, variables) => {
      const organizationId = (schedule as any)?.organization_id
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['schedule', variables.id, organizationId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['schedule', variables.id] })
      }
      queryClient.invalidateQueries({ queryKey: ['schedule-executions'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })

      toast({
        title: '스케줄 일시정지',
        description: '스케줄이 일시정지되었습니다. 예정된 실행과 알림이 취소되었습니다.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: '일시정지 실패',
        description: error.message || '스케줄 일시정지 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsPausing(false)
    },
  })

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async ({ id, options }: { id: string; options: ResumeOptions }) => {
      setIsResuming(true)
      await stateManager.resumeSchedule(id, options)
    },
    onSuccess: (_, variables) => {
      const organizationId = (schedule as any)?.organization_id
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['schedule', variables.id, organizationId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['schedule', variables.id] })
      }
      queryClient.invalidateQueries({ queryKey: ['schedule-executions'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })

      const strategyMessage = {
        immediate: '즉시 실행으로',
        next_cycle: '다음 주기부터',
        custom: '지정된 날짜부터',
      }[variables.options.strategy]

      toast({
        title: '스케줄 재개',
        description: `스케줄이 ${strategyMessage} 재개되었습니다.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: '재개 실패',
        description: error.message || '스케줄 재개 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsResuming(false)
    },
  })

  const pauseSchedule = async (id: string, options?: PauseOptions) => {
    if (!canPause) {
      toast({
        title: '일시정지 불가',
        description: '현재 상태에서는 스케줄을 일시정지할 수 없습니다.',
        variant: 'destructive',
      })
      return
    }

    await pauseMutation.mutateAsync({ id, options })
  }

  const resumeSchedule = async (id: string, options: ResumeOptions) => {
    if (!canResume) {
      toast({
        title: '재개 불가',
        description: '현재 상태에서는 스케줄을 재개할 수 없습니다.',
        variant: 'destructive',
      })
      return
    }

    // Validate options
    if (options.strategy === 'custom' && !options.customDate) {
      toast({
        title: '날짜 선택 필요',
        description: '사용자 지정 전략을 선택한 경우 날짜를 지정해야 합니다.',
        variant: 'destructive',
      })
      return
    }

    await resumeMutation.mutateAsync({ id, options })
  }

  return {
    isPausing,
    isResuming,
    pauseSchedule,
    resumeSchedule,
    canPause,
    canResume,
    pauseDuration,
    suggestedStrategy,
  }
}

/**
 * 여러 스케줄의 상태를 일괄 관리하기 위한 훅
 */
export function useBulkScheduleState() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const stateManager = new ScheduleStateManager()

  const bulkPauseMutation = useMutation({
    mutationFn: async (scheduleIds: string[]) => {
      const results = await Promise.allSettled(
        scheduleIds.map(id => stateManager.pauseSchedule(id))
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      return { succeeded, failed, total: scheduleIds.length }
    },
    onSuccess: (data) => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['schedules'] })

      toast({
        title: '일괄 일시정지 완료',
        description: `${data.succeeded}개 성공, ${data.failed}개 실패`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: '일괄 처리 실패',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkResumeMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; options: ResumeOptions }>) => {
      const results = await Promise.allSettled(
        items.map(item => stateManager.resumeSchedule(item.id, item.options))
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      return { succeeded, failed, total: items.length }
    },
    onSuccess: (data) => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['schedules'] })

      toast({
        title: '일괄 재개 완료',
        description: `${data.succeeded}개 성공, ${data.failed}개 실패`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: '일괄 처리 실패',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return {
    bulkPause: bulkPauseMutation.mutate,
    bulkResume: bulkResumeMutation.mutate,
    isBulkPausing: bulkPauseMutation.isPending,
    isBulkResuming: bulkResumeMutation.isPending,
  }
}