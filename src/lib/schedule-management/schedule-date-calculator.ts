'use client'

import { addWeeks, differenceInWeeks, startOfDay, isAfter, isBefore } from 'date-fns'
import type { Schedule } from '@/types/schedule'

export interface RecalculationOptions {
  strategy: 'immediate' | 'next_cycle' | 'custom'
  customDate?: Date
  skipMissed?: boolean
}

export interface MissedExecution {
  date: Date
  weeksOverdue: number
}

/**
 * 스케줄의 날짜 계산을 담당하는 클래스
 * 일시정지 후 재개 시 next_due_date 재계산 로직을 처리합니다.
 */
export class ScheduleDateCalculator {
  /**
   * 재개 시 다음 예정일을 계산합니다.
   * @param schedule 스케줄 정보
   * @param options 재계산 옵션
   * @returns 계산된 다음 예정일
   */
  calculateNextDueDate(schedule: Schedule, options: RecalculationOptions): Date {
    const today = startOfDay(new Date())
    const intervalWeeks = schedule.intervalWeeks || 1

    switch (options.strategy) {
      case 'immediate':
        // 즉시 실행 - 오늘을 다음 예정일로 설정
        return today

      case 'next_cycle':
        // 다음 주기부터 시작 - 오늘부터 interval_weeks 후
        return addWeeks(today, intervalWeeks)

      case 'custom':
        // 사용자 지정 날짜
        if (!options.customDate) {
          throw new Error('Custom strategy requires customDate')
        }
        return startOfDay(options.customDate)

      default:
        // 기본값: 다음 주기
        return addWeeks(today, intervalWeeks)
    }
  }

  /**
   * 일시정지 기간 동안 놓친 실행들을 계산합니다.
   * @param schedule 스케줄 정보
   * @param pausedDate 일시정지 날짜
   * @param resumeDate 재개 날짜
   * @returns 놓친 실행 날짜 배열
   */
  getMissedExecutions(
    schedule: Schedule,
    pausedDate: Date,
    resumeDate: Date
  ): MissedExecution[] {
    const missed: MissedExecution[] = []
    const intervalWeeks = schedule.intervalWeeks || 1

    // Start from the last next_due_date before pause
    let currentDate = new Date(schedule.nextDueDate)
    const pausedStart = startOfDay(pausedDate)
    const resumeStart = startOfDay(resumeDate)

    // Calculate all dates that should have been executed during pause
    while (isBefore(currentDate, resumeStart)) {
      if (isAfter(currentDate, pausedStart) ||
          currentDate.getTime() === pausedStart.getTime()) {
        const weeksOverdue = differenceInWeeks(resumeStart, currentDate)
        missed.push({
          date: new Date(currentDate),
          weeksOverdue
        })
      }
      currentDate = addWeeks(currentDate, intervalWeeks)
    }

    return missed
  }

  /**
   * 놓친 실행을 따라잡기 위한 날짜들을 계산합니다.
   * @param schedule 스케줄 정보
   * @param missedCount 놓친 실행 수
   * @returns 따라잡기 실행 날짜 배열
   */
  calculateCatchUpDates(schedule: Schedule, missedCount: number): Date[] {
    if (missedCount <= 0) return []

    const dates: Date[] = []
    const today = startOfDay(new Date())
    const intervalWeeks = schedule.intervalWeeks || 1

    // Compress missed executions into shorter intervals
    // For example, if missed 4 executions with 2-week interval,
    // schedule them weekly instead of bi-weekly to catch up faster
    const catchUpIntervalWeeks = Math.max(1, Math.floor(intervalWeeks / 2))

    let currentDate = today
    for (let i = 0; i < missedCount; i++) {
      dates.push(new Date(currentDate))
      currentDate = addWeeks(currentDate, catchUpIntervalWeeks)
    }

    // Check if any dates exceed schedule end date
    if (schedule.endDate) {
      const endDate = new Date(schedule.endDate)
      return dates.filter(date => !isAfter(date, endDate))
    }

    return dates
  }

  /**
   * 스케줄의 남은 실행 횟수를 계산합니다.
   * @param schedule 스케줄 정보
   * @param fromDate 시작 날짜
   * @returns 남은 실행 횟수 (무제한인 경우 null)
   */
  getRemainingExecutions(schedule: Schedule, fromDate: Date = new Date()): number | null {
    if (!schedule.endDate) {
      return null // Infinite executions
    }

    const start = startOfDay(fromDate)
    const end = startOfDay(new Date(schedule.endDate))

    if (isAfter(start, end)) {
      return 0
    }

    const intervalWeeks = schedule.intervalWeeks || 1
    const weeksDifference = differenceInWeeks(end, start)

    return Math.floor(weeksDifference / intervalWeeks) + 1
  }

  /**
   * 다음 실행일이 유효한지 검증합니다.
   * @param schedule 스케줄 정보
   * @param proposedDate 제안된 날짜
   * @returns 유효성 여부와 이유
   */
  validateNextDueDate(
    schedule: Schedule,
    proposedDate: Date
  ): { isValid: boolean; reason?: string } {
    const proposed = startOfDay(proposedDate)
    const today = startOfDay(new Date())

    // Check if date is in the past
    if (isBefore(proposed, today)) {
      return {
        isValid: false,
        reason: '다음 예정일은 과거 날짜가 될 수 없습니다.'
      }
    }

    // Check if date exceeds end date
    if (schedule.endDate) {
      const endDate = startOfDay(new Date(schedule.endDate))
      if (isAfter(proposed, endDate)) {
        return {
          isValid: false,
          reason: '다음 예정일이 종료일을 초과합니다.'
        }
      }
    }

    // Check if date respects minimum interval
    if (schedule.lastExecutedDate) {
      const lastExecuted = new Date(schedule.lastExecutedDate)
      const weeksSinceLastExecution = differenceInWeeks(proposed, lastExecuted)

      if (weeksSinceLastExecution < 1) {
        return {
          isValid: false,
          reason: '최소 1주 간격이 필요합니다.'
        }
      }
    }

    return { isValid: true }
  }

  /**
   * 최적의 재개 전략을 제안합니다.
   * @param schedule 스케줄 정보
   * @param pauseDuration 일시정지 기간 (주)
   * @returns 추천 전략
   */
  suggestResumeStrategy(
    schedule: Schedule,
    pauseDuration: number
  ): RecalculationOptions['strategy'] {
    const intervalWeeks = schedule.intervalWeeks || 1

    // Short pause (less than one interval): immediate resume
    if (pauseDuration < intervalWeeks) {
      return 'immediate'
    }

    // Long pause (more than 4 intervals): start fresh with next cycle
    if (pauseDuration > intervalWeeks * 4) {
      return 'next_cycle'
    }

    // Medium pause: let user decide
    return 'custom'
  }
}