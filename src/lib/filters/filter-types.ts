'use client'

// Filter types for schedule and patient filtering
export type CareType = '외래' | '입원' | '낮병원'

export interface ScheduleFilter {
  // 진료 구분 필터 (복수 선택 가능)
  careTypes: CareType[]

  // 주치의 필터 (향후 구현 대비)
  doctorId?: string | null

  // 부서 필터 (선택적)
  department?: string | null

  // 날짜 범위 필터 (선택적)
  dateRange?: {
    start: string // yyyy-MM-dd format
    end: string   // yyyy-MM-dd format
  } | null

  // 스케줄 상태 필터
  includeInactive?: boolean

  // 역할 기반 필터 - 전체 보기 토글
  showAll?: boolean

  // 긴급도 필터 (의료 환경 특화)
  urgencyLevel?: 'all' | 'urgent' | 'normal'
}

export interface FilterState {
  filters: ScheduleFilter
  isFiltering: boolean
}

// Default filter values
export const defaultFilters: ScheduleFilter = {
  careTypes: [], // 빈 배열 = 모든 타입 표시
  doctorId: null,
  department: null,
  dateRange: null,
  includeInactive: false,
  showAll: false, // 기본적으로 역할 기반 필터 적용
  urgencyLevel: 'all'
}

// Helper functions
export const hasActiveFilters = (filters: ScheduleFilter): boolean => {
  return (
    filters.careTypes.length > 0 ||
    filters.doctorId !== null ||
    filters.department !== null ||
    filters.dateRange !== null ||
    filters.includeInactive === true ||
    filters.showAll === true ||
    (filters.urgencyLevel !== undefined && filters.urgencyLevel !== 'all')
  )
}

export const resetFilters = (): ScheduleFilter => {
  return { ...defaultFilters }
}

// Care type display labels
export const careTypeLabels: Record<CareType, string> = {
  '외래': '외래',
  '입원': '입원',
  '낮병원': '낮병원'
}

// Care type colors for UI
export const careTypeColors: Record<CareType, string> = {
  '외래': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  '입원': 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  '낮병원': 'bg-green-100 text-green-700 hover:bg-green-200'
}