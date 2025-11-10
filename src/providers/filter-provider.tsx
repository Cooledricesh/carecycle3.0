'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FilterContext } from '@/lib/filters/filter-context'
import {
  defaultFilters,
  hasActiveFilters as checkHasActiveFilters,
  type ScheduleFilter,
  type CareType
} from '@/lib/filters/filter-types'

interface FilterProviderProps {
  children: React.ReactNode
  persistToUrl?: boolean // Whether to persist filters to URL params
}

export function FilterProvider({
  children,
  persistToUrl = false
}: FilterProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize filters from URL if persistToUrl is enabled
  const initializeFilters = (): ScheduleFilter => {
    if (!persistToUrl) return defaultFilters

    const departmentIdsParam = searchParams.get('departmentIds')
    const doctorIdParam = searchParams.get('doctorId')

    return {
      ...defaultFilters,
      department_ids: departmentIdsParam
        ? departmentIdsParam.split(',').filter(Boolean)
        : [],
      doctorId: doctorIdParam || null,
    }
  }

  const [filters, setFilters] = useState<ScheduleFilter>(initializeFilters)
  const [isLoading, setIsLoading] = useState(false)

  // Sync filters to URL when they change
  useEffect(() => {
    if (!persistToUrl) return

    const params = new URLSearchParams(searchParams)

    // Update URL params based on filters
    if (filters.department_ids.length > 0) {
      params.set('departmentIds', filters.department_ids.join(','))
    } else {
      params.delete('departmentIds')
    }

    if (filters.doctorId) {
      params.set('doctorId', filters.doctorId)
    } else {
      params.delete('doctorId')
    }

    // Only update URL if params actually changed
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    if (newUrl !== `${pathname}${window.location.search}`) {
      router.replace(newUrl)
    }
  }, [filters, persistToUrl, pathname, router, searchParams])

  // Update filters (partial update)
  const updateFilters = useCallback((updates: Partial<ScheduleFilter>) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }))
  }, [])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  // Toggle a department (multi-select support)
  const toggleDepartment = useCallback((departmentId: string) => {
    setFilters(prev => {
      const currentIds = [...prev.department_ids]
      const index = currentIds.indexOf(departmentId)

      if (index > -1) {
        // Remove if already selected
        currentIds.splice(index, 1)
      } else {
        // Add if not selected
        currentIds.push(departmentId)
      }

      return {
        ...prev,
        department_ids: currentIds
      }
    })
  }, [])

  // DEPRECATED: Legacy care type toggle (for backward compatibility)
  const toggleCareType = useCallback((careType: CareType) => {
    // Delegate to toggleDepartment since care_type is used as department_id in Phase 1
    toggleDepartment(careType)
  }, [toggleDepartment])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return checkHasActiveFilters(filters)
  }, [filters])

  const contextValue = useMemo(() => ({
    filters,
    updateFilters,
    resetFilters,
    toggleDepartment,
    toggleCareType, // Keep for backward compatibility
    hasActiveFilters,
    isLoading
  }), [filters, updateFilters, resetFilters, toggleDepartment, toggleCareType, hasActiveFilters, isLoading])

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  )
}