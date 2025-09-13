'use client'

import type { ScheduleStatus } from '@/lib/database.types'
import type { Schedule } from '@/types/schedule'

export interface StateTransitionRule {
  from: ScheduleStatus
  to: ScheduleStatus
  allowed: boolean
  requiresDateRecalculation?: boolean
  requiresDataSync?: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  requiredActions: string[]
}

/**
 * 스케줄 상태 전환 유효성 검증을 담당하는 클래스
 * 상태 전환 규칙을 정의하고 검증합니다.
 */
export class ScheduleStateValidator {
  private static transitionRules: StateTransitionRule[] = [
    // Active state transitions
    { from: 'active', to: 'paused', allowed: true, requiresDataSync: true },
    { from: 'active', to: 'completed', allowed: true },
    { from: 'active', to: 'cancelled', allowed: true, requiresDataSync: true },

    // Paused state transitions
    { from: 'paused', to: 'active', allowed: true, requiresDateRecalculation: true, requiresDataSync: true },
    { from: 'paused', to: 'cancelled', allowed: true },
    { from: 'paused', to: 'completed', allowed: false }, // Cannot complete a paused schedule

    // Completed state transitions
    { from: 'completed', to: 'active', allowed: false },
    { from: 'completed', to: 'paused', allowed: false },
    { from: 'completed', to: 'cancelled', allowed: false },

    // Cancelled state transitions
    { from: 'cancelled', to: 'active', allowed: false },
    { from: 'cancelled', to: 'paused', allowed: false },
    { from: 'cancelled', to: 'completed', allowed: false },
  ]

  /**
   * 상태 전환이 유효한지 검증합니다.
   */
  validateTransition(from: ScheduleStatus, to: ScheduleStatus): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      requiredActions: []
    }

    // Same state transition is always allowed (no-op)
    if (from === to) {
      result.isValid = true
      result.warnings.push('상태가 변경되지 않습니다.')
      return result
    }

    // Find matching rule
    const rule = ScheduleStateValidator.transitionRules.find(
      r => r.from === from && r.to === to
    )

    if (!rule) {
      result.errors.push(`'${from}'에서 '${to}'로의 전환은 정의되지 않았습니다.`)
      return result
    }

    if (!rule.allowed) {
      result.errors.push(`'${from}'에서 '${to}'로의 전환은 허용되지 않습니다.`)
      return result
    }

    result.isValid = true

    // Add required actions
    if (rule.requiresDateRecalculation) {
      result.requiredActions.push('next_due_date 재계산 필요')
    }

    if (rule.requiresDataSync) {
      result.requiredActions.push('연관 데이터 동기화 필요')
    }

    // Add specific warnings based on transition
    if (from === 'active' && to === 'paused') {
      result.warnings.push('예정된 실행과 알림이 취소됩니다.')
    }

    if (from === 'paused' && to === 'active') {
      result.warnings.push('일시정지 기간 동안의 실행이 누락될 수 있습니다.')
    }

    return result
  }

  /**
   * 스케줄을 일시정지할 수 있는지 확인합니다.
   */
  canPause(schedule: Schedule): boolean {
    if (schedule.status !== 'active') {
      return false
    }

    // Check if schedule has already ended
    if (schedule.endDate) {
      const endDate = new Date(schedule.endDate)
      if (endDate < new Date()) {
        return false
      }
    }

    return true
  }

  /**
   * 스케줄을 재개할 수 있는지 확인합니다.
   */
  canResume(schedule: Schedule): boolean {
    if (schedule.status !== 'paused') {
      return false
    }

    // Check if schedule has already ended
    if (schedule.endDate) {
      const endDate = new Date(schedule.endDate)
      if (endDate < new Date()) {
        return false
      }
    }

    return true
  }

  /**
   * 상태 전환을 차단하는 이유들을 반환합니다.
   */
  getBlockingReasons(schedule: Schedule, targetStatus: ScheduleStatus): string[] {
    const reasons: string[] = []

    const validation = this.validateTransition(schedule.status, targetStatus)
    if (!validation.isValid) {
      reasons.push(...validation.errors)
    }

    // Check schedule end date
    if (schedule.endDate) {
      const endDate = new Date(schedule.endDate)
      if (endDate < new Date()) {
        reasons.push('종료된 스케줄은 상태를 변경할 수 없습니다.')
      }
    }

    // Check for active executions
    if (targetStatus === 'completed' && schedule.status === 'active') {
      // This would need to check if all executions are completed
      // For now, we'll add a placeholder
      reasons.push('모든 실행이 완료되었는지 확인이 필요합니다.')
    }

    return reasons
  }

  /**
   * 특정 전환에 필요한 액션들을 반환합니다.
   */
  getRequiredActions(from: ScheduleStatus, to: ScheduleStatus): string[] {
    const validation = this.validateTransition(from, to)
    return validation.requiredActions
  }
}