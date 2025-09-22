import { isToday, isBefore, differenceInDays } from 'date-fns'
import { safeParse } from '@/lib/utils/date'
import type { ScheduleWithDetails } from '@/types/schedule'

export interface ScheduleStatusInfo {
  label: string
  variant: 'today' | 'overdue' | 'upcoming' | 'future'
  priority: number // 낮을수록 우선순위 높음
}

/**
 * 스케줄의 상태 레이블과 정보를 반환합니다.
 * @param schedule 스케줄 정보
 * @returns 상태 레이블과 variant 정보
 */
export function getScheduleStatusLabel(schedule: ScheduleWithDetails): ScheduleStatusInfo {
  const scheduleDate = safeParse(schedule.next_due_date)

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
  
  // 지난 날짜인 경우 (연체)
  if (isBefore(scheduleDate, today) && schedule.status === 'active') {
    const daysOverdue = Math.abs(differenceInDays(scheduleDate, today))
    return {
      label: `${daysOverdue}일 연체`,
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
 * 스케줄 목록을 우선순위에 따라 정렬합니다.
 * @param schedules 스케줄 목록
 * @returns 정렬된 스케줄 목록
 */
export function sortSchedulesByPriority(schedules: ScheduleWithDetails[]): ScheduleWithDetails[] {
  return [...schedules].sort((a, b) => {
    const statusA = getScheduleStatusLabel(a)
    const statusB = getScheduleStatusLabel(b)

    // 우선순위로 정렬 (연체 > 오늘 > 가까운 미래 > 먼 미래)
    if (statusA.priority !== statusB.priority) {
      return statusA.priority - statusB.priority
    }

    // 같은 우선순위면 날짜로 정렬
    const dateA = safeParse(a.next_due_date)
    const dateB = safeParse(b.next_due_date)
    
    if (!dateA || !dateB) return 0
    return dateA.getTime() - dateB.getTime()
  })
}