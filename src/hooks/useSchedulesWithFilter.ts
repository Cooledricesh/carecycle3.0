'use client'

import { useIsFilterContextAvailable, useFilterContext } from '@/lib/filters/filter-context'
import { useSchedules, useTodayChecklist, useUpcomingSchedules } from './useSchedules'
import { useFilteredSchedules, useFilteredTodayChecklist, useFilteredUpcomingSchedules } from './useFilteredSchedules'

// Wrapper hooks that automatically use filtered versions when filter context is available
export function useSchedulesWithOptionalFilter() {
  const isFilterAvailable = useIsFilterContextAvailable()

  if (isFilterAvailable) {
    return useFilteredSchedules()
  } else {
    return useSchedules()
  }
}

export function useTodayChecklistWithOptionalFilter() {
  const isFilterAvailable = useIsFilterContextAvailable()

  if (isFilterAvailable) {
    return useFilteredTodayChecklist()
  } else {
    return useTodayChecklist()
  }
}

export function useUpcomingSchedulesWithOptionalFilter(daysAhead: number = 7) {
  const isFilterAvailable = useIsFilterContextAvailable()

  if (isFilterAvailable) {
    return useFilteredUpcomingSchedules(daysAhead)
  } else {
    return useUpcomingSchedules(daysAhead)
  }
}