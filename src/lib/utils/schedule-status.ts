import { isToday, isBefore, differenceInDays } from 'date-fns'
import { safeParse } from '@/lib/utils/date'
import type { ScheduleWithDetails, Schedule, ScheduleWithRelations } from '@/types/schedule'

export interface ScheduleStatusInfo {
  label: string
  variant: 'today' | 'overdue' | 'upcoming' | 'future'
  priority: number // 낮을수록 우선순위 높음
}

// Type guard to check if schedule has snake_case date field
function hasSnakeCaseDate(schedule: any): schedule is ScheduleWithDetails {
  return 'next_due_date' in schedule;
}

/**
 * 스케줄의 상태 레이블과 정보를 반환합니다.
 * @param schedule 스케줄 정보 (both camelCase and snake_case supported)
 * @returns 상태 레이블과 variant 정보
 */
export function getScheduleStatusLabel(schedule: ScheduleWithDetails | Schedule | ScheduleWithRelations): ScheduleStatusInfo {
  // Handle both snake_case and camelCase date fields
  const dateString = hasSnakeCaseDate(schedule)
    ? schedule.next_due_date
    : (schedule as Schedule | ScheduleWithRelations).nextDueDate;

  const scheduleDate = safeParse(dateString)

  if (!scheduleDate) {
    return {
      label: '날짜 오류',
      variant: 'future',
      priority: 999
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  scheduleDate.setHours(0, 0, 0, 0)
  
  // 오늘인 경우
  if (isToday(scheduleDate)) {
    return {
      label: '오늘',
      variant: 'today',
      priority: 1
    }
  }
  
  // 지난 날짜인 경우 (지연)
  if (isBefore(scheduleDate, today) && schedule.status === 'active') {
    const daysOverdue = Math.abs(differenceInDays(scheduleDate, today))
    return {
      label: `${daysOverdue}일 지연`,
      variant: 'overdue',
      priority: 0
    }
  }
  
  // 미래 날짜인 경우
  const daysUntil = differenceInDays(scheduleDate, today)
  
  if (daysUntil === 1) {
    return {
      label: '내일',
      variant: 'upcoming',
      priority: 2
    }
  }
  
  if (daysUntil <= 7) {
    return {
      label: `${daysUntil}일 후`,
      variant: 'upcoming',
      priority: 3
    }
  }
  
  return {
    label: `${daysUntil}일 후`,
    variant: 'future',
    priority: 4
  }
}

/**
 * 상태 variant에 따른 배지 스타일 클래스를 반환합니다.
 * @param variant 상태 variant
 * @returns 스타일 클래스 문자열
 */
export function getStatusBadgeClass(variant: ScheduleStatusInfo['variant']): string {
  switch (variant) {
    case 'overdue':
      return 'bg-red-100 text-red-700'
    case 'today':
      return 'bg-orange-100 text-orange-700'
    case 'upcoming':
      return 'bg-yellow-100 text-yellow-700'
    case 'future':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

/**
 * 스케줄의 완료 여부를 확인합니다.
 * @param schedule 스케줄 정보
 * @returns 완료 여부
 */
function isScheduleCompleted(schedule: any): boolean {
  // Check both display_type and status field for completion
  // display_type is set for calendar views (includes completed executions)
  // status is the schedule's base state ('active', 'completed', 'cancelled')
  return schedule.display_type === 'completed' || schedule.status === 'completed'
}

/**
 * 스케줄의 날짜 문자열을 추출합니다.
 * @param schedule 스케줄 정보
 * @returns 날짜 문자열
 */
function getScheduleDateString(schedule: any): string {
  return hasSnakeCaseDate(schedule) ? schedule.next_due_date : schedule.nextDueDate
}

/**
 * 두 스케줄을 날짜로 비교합니다.
 * @param a 첫 번째 스케줄
 * @param b 두 번째 스케줄
 * @param descending 내림차순 여부 (기본값: false)
 * @returns 비교 결과
 */
function compareDates(a: any, b: any, descending = false): number {
  const dateStringA = getScheduleDateString(a)
  const dateStringB = getScheduleDateString(b)
  const dateA = safeParse(dateStringA)
  const dateB = safeParse(dateStringB)

  if (!dateA || !dateB) return 0

  const diff = dateA.getTime() - dateB.getTime()
  return descending ? -diff : diff
}

/**
 * 스케줄 목록을 우선순위에 따라 정렬합니다.
 * Phase 3.1: 완료 여부를 1순위로, 미완료 항목이 항상 먼저 오도록 정렬
 *
 * 정렬 순서:
 * 1. 완료 여부 (미완료 먼저)
 * 2. 완료된 항목: 날짜 내림차순 (최근 먼저)
 * 3. 미완료 항목: 우선순위 (지연 > 오늘 > 가까운 미래 > 먼 미래) → 날짜 오름차순
 *
 * @param schedules 스케줄 목록
 * @returns 정렬된 스케줄 목록
 */
export function sortSchedulesByPriority<T extends ScheduleWithDetails | Schedule | ScheduleWithRelations>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => {
    const isCompletedA = isScheduleCompleted(a)
    const isCompletedB = isScheduleCompleted(b)

    // 1순위: 완료 여부 (미완료가 먼저)
    if (isCompletedA !== isCompletedB) {
      return isCompletedA ? 1 : -1
    }

    // 완료된 항목들은 날짜 내림차순 (최근 항목이 먼저)
    if (isCompletedA && isCompletedB) {
      return compareDates(a, b, true)
    }

    // 미완료 항목들은 기존 우선순위 로직 적용
    const statusA = getScheduleStatusLabel(a)
    const statusB = getScheduleStatusLabel(b)

    // 우선순위로 정렬 (지연 > 오늘 > 가까운 미래 > 먼 미래)
    if (statusA.priority !== statusB.priority) {
      return statusA.priority - statusB.priority
    }

    // 같은 우선순위면 날짜로 정렬 (오름차순)
    return compareDates(a, b)
  })
}