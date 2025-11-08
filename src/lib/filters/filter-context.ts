'use client'

import { createContext, useContext } from 'react'
import type { ScheduleFilter } from './filter-types'

export interface FilterContextValue {
  // Current filter state
  filters: ScheduleFilter

  // Update filters (partial update)
  updateFilters: (updates: Partial<ScheduleFilter>) => void

  // Reset all filters to default
  resetFilters: () => void

  // Toggle a department (multi-select support)
  toggleDepartment: (departmentId: string) => void

  // DEPRECATED: Legacy care type toggle (for backward compatibility)
  toggleCareType?: (careType: '외래' | '입원' | '낮병원') => void

  // Check if any filters are active
  hasActiveFilters: boolean

  // Loading state for filter-dependent data
  isLoading?: boolean
}

// Create the context
export const FilterContext = createContext<FilterContextValue | null>(null)

// Custom hook to use the filter context
export const useFilterContext = () => {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider')
  }
  return context
}

// Export helper to check if we're in a filter context
export const useIsFilterContextAvailable = () => {
  try {
    const context = useContext(FilterContext)
    return context !== null
  } catch {
    return false
  }
}