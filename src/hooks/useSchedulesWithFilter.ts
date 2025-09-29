'use client'

import { useIsFilterContextAvailable, useFilterContext } from '@/lib/filters/filter-context'
import { useSchedules, useTodayChecklist, useUpcomingSchedules } from './useSchedules'
import { useFilteredSchedules, useFilteredTodayChecklist, useFilteredUpcomingSchedules } from './useFilteredSchedules'

// Wrapper hooks that automatically use filtered versions when filter context is available
export function useSchedulesWithOptionalFilter() {
  const isFilterAvailable = useIsFilterContextAvailable()

  // Call both hooks unconditionally to satisfy React's Rules of Hooks
  const filteredResult = useFilteredSchedules()
  const unfilteredResult = useSchedules()

  // Return the appropriate result based on the condition
  if (isFilterAvailable) {
    return filteredResult
  } else {
    return unfilteredResult
  }
}

export function useTodayChecklistWithOptionalFilter() {
  const isFilterAvailable = useIsFilterContextAvailable()

  // Call both hooks unconditionally to satisfy React's Rules of Hooks
  const filteredResult = useFilteredTodayChecklist()
  const unfilteredResult = useTodayChecklist()

  // Return the appropriate result based on the condition
  if (isFilterAvailable) {
    return filteredResult
  } else {
    return unfilteredResult
  }
}

export function useUpcomingSchedulesWithOptionalFilter(daysAhead: number = 7) {
  const isFilterAvailable = useIsFilterContextAvailable()

  // Call both hooks unconditionally to satisfy React's Rules of Hooks
  const filteredResult = useFilteredUpcomingSchedules(daysAhead)
  const unfilteredResult = useUpcomingSchedules(daysAhead)

  // Return the appropriate result based on the condition
  if (isFilterAvailable) {
    return filteredResult
  } else {
    return unfilteredResult
  }
}