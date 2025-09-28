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

    const careTypesParam = searchParams.get('careTypes')
    const doctorIdParam = searchParams.get('doctorId')

    return {
      ...defaultFilters,
      careTypes: careTypesParam
        ? (careTypesParam.split(',').filter(t =>
            ['외래', '입원', '낮병원'].includes(t)) as CareType[])
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
    if (filters.careTypes.length > 0) {
      params.set('careTypes', filters.careTypes.join(','))
    } else {
      params.delete('careTypes')
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

  // Toggle a care type
  const toggleCareType = useCallback((careType: CareType) => {
    setFilters(prev => {
      const currentTypes = [...prev.careTypes]
      const index = currentTypes.indexOf(careType)

      if (index > -1) {
        // Remove if already selected
        currentTypes.splice(index, 1)
      } else {
        // Add if not selected
        currentTypes.push(careType)
      }

      return {
        ...prev,
        careTypes: currentTypes
      }
    })
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return checkHasActiveFilters(filters)
  }, [filters])

  const contextValue = useMemo(() => ({
    filters,
    updateFilters,
    resetFilters,
    toggleCareType,
    hasActiveFilters,
    isLoading
  }), [filters, updateFilters, resetFilters, toggleCareType, hasActiveFilters, isLoading])

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  )
}