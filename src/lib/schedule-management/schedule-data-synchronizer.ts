'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SyncResult {
  executionsUpdated: number
  notificationsCancelled: number
  notificationsCreated: number
  errors: Error[]
}

/**
 * 스케줄 상태 변경 시 연관 데이터 동기화를 담당하는 클래스
 * schedule_executions와 notifications 테이블의 정합성을 보장합니다.
 */
export class ScheduleDataSynchronizer {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient()
  }

  /**
   * 스케줄 일시정지 시 연관 데이터를 동기화합니다.
   * @param scheduleId 스케줄 ID
   * @returns 동기화 결과
   */
  async syncOnPause(scheduleId: string): Promise<SyncResult> {
    const result: SyncResult = {
      executionsUpdated: 0,
      notificationsCancelled: 0,
      notificationsCreated: 0,
      errors: []
    }

    try {
      // 1. Skip all planned executions
      const executionsUpdated = await this.skipPlannedExecutions(scheduleId)
      result.executionsUpdated = executionsUpdated

      // 2. Cancel all pending notifications
      const notificationsCancelled = await this.cancelPendingNotifications(scheduleId)
      result.notificationsCancelled = notificationsCancelled

    } catch (error) {
      result.errors.push(error as Error)
      console.error('Error syncing on pause:', error)
    }

    return result
  }

  /**
   * 스케줄 재개 시 연관 데이터를 동기화합니다.
   * @param scheduleId 스케줄 ID
   * @param nextDueDate 재계산된 다음 예정일
   * @returns 동기화 결과
   */
  async syncOnResume(scheduleId: string, nextDueDate: Date): Promise<SyncResult> {
    const result: SyncResult = {
      executionsUpdated: 0,
      notificationsCancelled: 0,
      notificationsCreated: 0,
      errors: []
    }

    try {
      // 1. Create new execution for next due date
      const executionCreated = await this.createNewExecution(scheduleId, nextDueDate)
      if (executionCreated) {
        result.executionsUpdated = 1
      }

      // 2. Create notification if needed
      const notificationCreated = await this.createNotificationIfNeeded(scheduleId, nextDueDate)
      if (notificationCreated) {
        result.notificationsCreated = 1
      }

      // 3. Clean up any orphaned data
      await this.cleanupOrphanedData(scheduleId)

    } catch (error) {
      result.errors.push(error as Error)
      console.error('Error syncing on resume:', error)
    }

    return result
  }

  /**
   * 예정된 실행들을 건너뜁니다.
   * @param scheduleId 스케줄 ID
   * @returns 업데이트된 실행 수
   */
  private async skipPlannedExecutions(scheduleId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('schedule_executions')
      .update({
        status: 'skipped',
        skipped_reason: '스케줄 일시정지로 인한 건너뜀',
        updated_at: new Date().toISOString()
      })
      .eq('schedule_id', scheduleId)
      .eq('status', 'planned')
      .select('id')

    if (error) {
      console.error('Error skipping planned executions:', error)
      throw error
    }

    return data?.length || 0
  }

  /**
   * 보류 중인 알림들을 취소합니다.
   * @param scheduleId 스케줄 ID
   * @returns 취소된 알림 수
   */
  private async cancelPendingNotifications(scheduleId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({
        state: 'cancelled' as any, // Now we can use 'cancelled' after migration
        error_message: 'Schedule paused',
        updated_at: new Date().toISOString()
      })
      .eq('schedule_id', scheduleId)
      .in('state', ['pending', 'ready'])
      .select('id')

    if (error) {
      console.error('Error cancelling notifications:', error)
      throw error
    }

    return data?.length || 0
  }

  /**
   * 새로운 실행을 생성합니다 (UPSERT 패턴 사용).
   * @param scheduleId 스케줄 ID
   * @param plannedDate 계획된 날짜
   * @returns 생성 성공 여부
   */
  private async createNewExecution(
    scheduleId: string,
    plannedDate: Date
  ): Promise<boolean> {
    // Convert to UTC date (YYYY-MM-DD) to avoid timezone day shifts
    // This ensures consistent date boundaries regardless of local timezone
    const utcDate = new Date(Date.UTC(
      plannedDate.getFullYear(),
      plannedDate.getMonth(),
      plannedDate.getDate()
    ))
    const formattedDate = utcDate.toISOString().slice(0, 10)

    // Idempotent UPSERT - uses unique constraint on (schedule_id, planned_date)
    // This prevents race conditions where concurrent requests could create duplicates
    const { error } = await this.supabase
      .from('schedule_executions')
      .upsert(
        {
          schedule_id: scheduleId,
          planned_date: formattedDate,
          status: 'planned',
          skipped_reason: null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'schedule_id,planned_date',
          ignoreDuplicates: false  // Update existing if found
        }
      )

    if (error) {
      console.error('Error creating/updating execution:', error)
    }

    return !error
  }

  /**
   * 필요한 경우 알림을 생성합니다 (UPSERT 패턴 사용).
   * @param scheduleId 스케줄 ID
   * @param nextDueDate 다음 예정일
   * @returns 생성 성공 여부
   */
  private async createNotificationIfNeeded(
    scheduleId: string,
    nextDueDate: Date
  ): Promise<boolean> {
    // Get schedule details to check if notification is required
    const { data: schedule, error: scheduleError } = await this.supabase
      .from('schedules')
      .select('requires_notification, notification_days_before, assigned_nurse_id, created_by')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule || !schedule.requires_notification) {
      return false
    }

    const notificationDaysBefore = schedule.notification_days_before || 7
    const notifyDate = new Date(nextDueDate)
    notifyDate.setDate(notifyDate.getDate() - notificationDaysBefore)

    // 과거 알림일이면 생성하지 않음
    if (notifyDate < new Date()) {
      return false
    }

    // YYYY-MM-DD (UTC)로 안전 변환
    const formattedNotifyDate = new Date(Date.UTC(
      notifyDate.getFullYear(),
      notifyDate.getMonth(),
      notifyDate.getDate()
    )).toISOString().slice(0, 10)

    // Idempotent UPSERT - uses unique index on (schedule_id, notify_date)
    // This prevents duplicate notifications for same schedule on same date
    const { error } = await this.supabase
      .from('notifications')
      .upsert(
        {
          schedule_id: scheduleId,
          recipient_id: schedule.assigned_nurse_id || schedule.created_by,
          channel: 'dashboard',
          notify_date: formattedNotifyDate,
          state: 'pending',
          title: '일정 알림',
          message: `예정된 일정이 ${notificationDaysBefore}일 후 도래합니다.`,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'schedule_id,notify_date',
          ignoreDuplicates: false  // Update existing if found
        }
      )

    return !error
  }

  /**
   * 고아 데이터를 정리합니다.
   * @param scheduleId 스케줄 ID
   */
  async cleanupOrphanedData(scheduleId: string): Promise<SyncResult> {
    const result: SyncResult = {
      executionsUpdated: 0,
      notificationsCancelled: 0,
      notificationsCreated: 0,
      errors: []
    }

    try {
      // Get schedule details
      const { data: schedule, error: scheduleError } = await this.supabase
        .from('schedules')
        .select('status, next_due_date')
        .eq('id', scheduleId)
        .single()

      if (scheduleError || !schedule) {
        throw new Error('Schedule not found')
      }

      // If schedule is not active, skip cleanup
      if (schedule.status !== 'active') {
        return result
      }

      // Clean up planned executions that are before next_due_date
      const { data: outdatedExecutions } = await this.supabase
        .from('schedule_executions')
        .update({
          status: 'skipped',
          skipped_reason: '날짜가 지나 자동 건너뜀',
          updated_at: new Date().toISOString()
        })
        .eq('schedule_id', scheduleId)
        .eq('status', 'planned')
        .lt('planned_date', schedule.next_due_date)
        .select('id')

      result.executionsUpdated = outdatedExecutions?.length || 0

      // Clean up notifications for past dates
      // Use UTC date to ensure consistent date boundaries
      const now = new Date()
      const todayUTC = new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )).toISOString().slice(0, 10)

      const { data: outdatedNotifications } = await this.supabase
        .from('notifications')
        .update({
          state: 'cancelled' as any, // Now we can use 'cancelled' after migration
          error_message: 'Notification date passed',
          updated_at: new Date().toISOString()
        })
        .eq('schedule_id', scheduleId)
        .in('state', ['pending', 'ready'])
        .lt('notify_date', todayUTC)
        .select('id')

      result.notificationsCancelled = outdatedNotifications?.length || 0

    } catch (error) {
      result.errors.push(error as Error)
      console.error('Error cleaning up orphaned data:', error)
    }

    return result
  }

  /**
   * 트랜잭션 내에서 모든 동기화 작업을 수행합니다.
   * @param scheduleId 스케줄 ID
   * @param operations 수행할 작업들
   */
  async syncInTransaction(
    scheduleId: string,
    operations: Array<'skipExecutions' | 'cancelNotifications' | 'createExecution' | 'createNotification'>,
    context?: { nextDueDate?: Date }
  ): Promise<SyncResult> {
    const result: SyncResult = {
      executionsUpdated: 0,
      notificationsCancelled: 0,
      notificationsCreated: 0,
      errors: []
    }

    // Note: Supabase doesn't support client-side transactions,
    // so we'll execute operations sequentially with error handling
    try {
      for (const operation of operations) {
        switch (operation) {
          case 'skipExecutions':
            result.executionsUpdated = await this.skipPlannedExecutions(scheduleId)
            break

          case 'cancelNotifications':
            result.notificationsCancelled = await this.cancelPendingNotifications(scheduleId)
            break

          case 'createExecution':
            if (context?.nextDueDate) {
              const created = await this.createNewExecution(scheduleId, context.nextDueDate)
              if (created) result.executionsUpdated++
            }
            break

          case 'createNotification':
            if (context?.nextDueDate) {
              const created = await this.createNotificationIfNeeded(scheduleId, context.nextDueDate)
              if (created) result.notificationsCreated++
            }
            break
        }
      }
    } catch (error) {
      result.errors.push(error as Error)
      // In a real transaction, we would rollback here
      console.error('Transaction failed:', error)
    }

    return result
  }
}