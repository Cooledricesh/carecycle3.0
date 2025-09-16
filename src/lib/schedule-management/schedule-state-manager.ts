'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@/lib/supabase/database'
import { ScheduleStateValidator } from './schedule-state-validator'
import { ScheduleDateCalculator, type RecalculationOptions } from './schedule-date-calculator'
import { ScheduleDataSynchronizer } from './schedule-data-synchronizer'
import type { Schedule } from '@/types/schedule'
import { format, differenceInWeeks } from 'date-fns'

export interface PauseOptions {
  reason?: string
  notifyAssignedNurse?: boolean
}

export interface ResumeOptions {
  strategy: RecalculationOptions['strategy']
  customDate?: Date
  handleMissed?: 'skip' | 'catch_up' | 'mark_overdue'
}

export interface StateTransition {
  id: string
  scheduleId: string
  fromStatus: string
  toStatus: string
  transitionDate: Date
  performedBy?: string
  reason?: string
  metadata?: Record<string, any>
}

/**
 * 스케줄 상태 관리를 총괄하는 매니저 클래스
 * 상태 전환, 데이터 동기화, 날짜 재계산을 조율합니다.
 */
export class ScheduleStateManager {
  private supabase: SupabaseClient
  private validator: ScheduleStateValidator
  private calculator: ScheduleDateCalculator
  private synchronizer: ScheduleDataSynchronizer

  constructor(
    supabaseClient?: SupabaseClient,
    validator?: ScheduleStateValidator,
    calculator?: ScheduleDateCalculator,
    synchronizer?: ScheduleDataSynchronizer
  ) {
    this.supabase = supabaseClient || createClient()
    this.validator = validator || new ScheduleStateValidator()
    this.calculator = calculator || new ScheduleDateCalculator()
    this.synchronizer = synchronizer || new ScheduleDataSynchronizer(this.supabase)
  }

  /**
   * 스케줄을 일시정지합니다.
   * @param scheduleId 스케줄 ID
   * @param options 일시정지 옵션
   */
  async pauseSchedule(scheduleId: string, options?: PauseOptions): Promise<void> {
    try {
      // 1. Get current schedule
      const { data: schedule, error: fetchError } = await this.supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (fetchError || !schedule) {
        throw new Error('스케줄을 찾을 수 없습니다.')
      }

      // 2. Validate state transition
      const validation = this.validator.validateTransition(schedule.status, 'paused')
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // 3. Check if can pause
      if (!this.validator.canPause(schedule)) {
        const reasons = this.validator.getBlockingReasons(schedule, 'paused')
        throw new Error(`일시정지할 수 없습니다: ${reasons.join(', ')}`)
      }

      // 4. Begin transaction (conceptual - Supabase doesn't support client-side transactions)

      // 5. Update schedule status
      const { error: updateError } = await this.supabase
        .from('schedules')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId)

      if (updateError) {
        throw updateError
      }

      // 6. Sync related data
      const syncResult = await this.synchronizer.syncOnPause(scheduleId)

      if (syncResult.errors.length > 0) {
        console.error('Sync errors during pause:', syncResult.errors)
        // In a real transaction, we would rollback here
      }

      // 7. Log state transition
      await this.logStateTransition({
        scheduleId,
        fromStatus: schedule.status,
        toStatus: 'paused',
        transitionDate: new Date(),
        reason: options?.reason,
        metadata: {
          executionsSkipped: syncResult.executionsUpdated,
          notificationsCancelled: syncResult.notificationsCancelled
        }
      })

      // 8. Notify if requested
      if (options?.notifyAssignedNurse && schedule.assigned_nurse_id) {
        await this.createSystemNotification(
          schedule.assigned_nurse_id,
          '스케줄 일시정지',
          `스케줄이 일시정지되었습니다. 사유: ${options.reason || '사유 없음'}`
        )
      }

    } catch (error) {
      console.error('Error pausing schedule:', error)
      throw error
    }
  }

  /**
   * 스케줄을 재개합니다.
   * @param scheduleId 스케줄 ID
   * @param options 재개 옵션
   */
  async resumeSchedule(scheduleId: string, options: ResumeOptions): Promise<void> {
    try {
      // 1. Get current schedule with additional details
      const { data: schedule, error: fetchError } = await this.supabase
        .from('schedules')
        .select(`
          *,
          patients (name),
          items (name)
        `)
        .eq('id', scheduleId)
        .single()

      if (fetchError || !schedule) {
        throw new Error('스케줄을 찾을 수 없습니다.')
      }

      // 2. Validate state transition
      const validation = this.validator.validateTransition(schedule.status, 'active')
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // 3. Check if can resume
      if (!this.validator.canResume(schedule)) {
        const reasons = this.validator.getBlockingReasons(schedule, 'active')
        throw new Error(`재개할 수 없습니다: ${reasons.join(', ')}`)
      }

      // 4. Calculate new next_due_date
      const recalculationOptions: RecalculationOptions = {
        strategy: options.strategy,
        customDate: options.customDate,
        skipMissed: options.handleMissed === 'skip'
      }

      const newNextDueDate = this.calculator.calculateNextDueDate(
        schedule,
        recalculationOptions
      )

      // 5. Validate the new date
      const dateValidation = this.calculator.validateNextDueDate(schedule, newNextDueDate)
      if (!dateValidation.isValid) {
        throw new Error(dateValidation.reason || '계산된 날짜가 유효하지 않습니다.')
      }

      // 6. Calculate missed executions if needed
      let missedExecutions = 0
      if (options.handleMissed !== 'skip' && schedule.updated_at) {
        const pausedDate = new Date(schedule.updated_at)
        const missed = this.calculator.getMissedExecutions(
          schedule,
          pausedDate,
          new Date()
        )
        missedExecutions = missed.length

        // Handle missed executions based on strategy
        if (options.handleMissed === 'catch_up' && missedExecutions > 0) {
          const catchUpDates = this.calculator.calculateCatchUpDates(
            schedule,
            missedExecutions
          )
          // Create catch-up executions
          for (const date of catchUpDates) {
            await this.supabase
              .from('schedule_executions')
              .insert({
                schedule_id: scheduleId,
                planned_date: format(date, 'yyyy-MM-dd'),
                status: 'planned',
                notes: '재개 후 따라잡기 실행'
              })
          }
        }
      }

      // 7. Update schedule with new status and next_due_date
      const { error: updateError } = await this.supabase
        .from('schedules')
        .update({
          status: 'active',
          next_due_date: format(newNextDueDate, 'yyyy-MM-dd'),
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId)

      if (updateError) {
        throw updateError
      }

      // 8. Sync related data
      const syncResult = await this.synchronizer.syncOnResume(scheduleId, newNextDueDate)

      if (syncResult.errors.length > 0) {
        console.error('Sync errors during resume:', syncResult.errors)
      }

      // 9. Log state transition
      await this.logStateTransition({
        scheduleId,
        fromStatus: 'paused',
        toStatus: 'active',
        transitionDate: new Date(),
        metadata: {
          resumeStrategy: options.strategy,
          newNextDueDate: format(newNextDueDate, 'yyyy-MM-dd'),
          missedExecutions,
          handleMissed: options.handleMissed,
          executionsCreated: syncResult.executionsUpdated,
          notificationsCreated: syncResult.notificationsCreated
        }
      })

    } catch (error) {
      console.error('Error resuming schedule:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        scheduleId,
        options
      })
      throw error
    }
  }

  /**
   * 스케줄의 상태 전환 이력을 조회합니다.
   * @param scheduleId 스케줄 ID
   * @returns 상태 전환 이력
   */
  async getStateTransitionHistory(scheduleId: string): Promise<StateTransition[]> {
    const { data, error } = await this.supabase
      .from('schedule_logs')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('changed_at', { ascending: false })

    if (error) {
      console.error('Error fetching transition history:', error)
      return []
    }

    return data.map(log => ({
      id: log.id,
      scheduleId: log.schedule_id,
      fromStatus: log.old_values?.status || '',
      toStatus: log.new_values?.status || '',
      transitionDate: new Date(log.changed_at),
      performedBy: log.changed_by,
      reason: log.reason,
      metadata: log.new_values
    }))
  }

  /**
   * 상태 전환을 로그에 기록합니다.
   * @param transition 전환 정보
   */
  private async logStateTransition(
    transition: Omit<StateTransition, 'id'>
  ): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()

      await this.supabase
        .from('schedule_logs')
        .insert({
          schedule_id: transition.scheduleId,
          action: `status_change_${transition.fromStatus}_to_${transition.toStatus}`,
          old_values: { status: transition.fromStatus },
          new_values: {
            status: transition.toStatus,
            ...transition.metadata
          },
          changed_by: user?.id || transition.performedBy,
          changed_at: transition.transitionDate.toISOString(),
          reason: transition.reason
        })
    } catch (error) {
      console.error('Error logging state transition:', error)
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * 시스템 알림을 생성합니다.
   * @param recipientId 수신자 ID
   * @param title 알림 제목
   * @param message 알림 메시지
   */
  private async createSystemNotification(
    recipientId: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('notifications')
        .insert({
          recipient_id: recipientId,
          channel: 'dashboard',
          notify_date: format(new Date(), 'yyyy-MM-dd'),
          state: 'ready',
          title,
          message,
          metadata: { type: 'system' }
        })
    } catch (error) {
      console.error('Error creating system notification:', error)
      // Don't throw - notification failure shouldn't break the operation
    }
  }

  /**
   * 일시정지 기간을 계산합니다.
   * @param schedule 스케줄 정보
   * @returns 일시정지 기간 (주)
   */
  getPauseDuration(schedule: Schedule): number | null {
    if (schedule.status !== 'paused' || !schedule.updated_at) {
      return null
    }

    const pausedDate = new Date(schedule.updated_at)
    const now = new Date()

    return differenceInWeeks(now, pausedDate)
  }

  /**
   * 재개 전략을 제안합니다.
   * @param schedule 스케줄 정보
   * @returns 추천 재개 전략
   */
  suggestResumeStrategy(schedule: Schedule): RecalculationOptions['strategy'] {
    const pauseDuration = this.getPauseDuration(schedule)

    if (pauseDuration === null) {
      return 'next_cycle'
    }

    return this.calculator.suggestResumeStrategy(schedule, pauseDuration)
  }
}