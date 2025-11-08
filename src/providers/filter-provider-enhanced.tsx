'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FilterContext } from '@/lib/filters/filter-context'
import {
  defaultFilters,
  hasActiveFilters as checkHasActiveFilters,
  type ScheduleFilter,
  type CareType
} from '@/lib/filters/filter-types'
import { FilterPersistence } from '@/lib/filters/filter-persistence'
import { RoleBasedFilterManager, type UserContext } from '@/lib/filters/role-based-filters'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile } from '@/hooks/useProfile'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'es-toolkit'

interface FilterProviderEnhancedProps {
  children: React.ReactNode
  persistToUrl?: boolean
  enableMultiTab?: boolean
  enablePersistence?: boolean
}

/**
 * Enhanced Filter Provider with:
 * - Role-based initialization
 * - Multi-tab synchronization
 * - State persistence across sessions
 * - Optimistic updates with rollback
 * - Filter validation and sanitization
 */
export function FilterProviderEnhanced({
  children,
  persistToUrl = true,
  enableMultiTab = true,
  enablePersistence = true
}: FilterProviderEnhancedProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // User context
  const { user } = useAuth()
  const { data: profile } = useProfile()

  // Refs for persistence and cleanup
  const persistenceRef = useRef<FilterPersistence | null>(null)
  const previousFiltersRef = useRef<ScheduleFilter | null>(null)
  const isInitializedRef = useRef(false)

  // Build user context
  const userContext: UserContext | null = useMemo(() => {
    if (!user || !profile) return null

    return {
      id: user.id,
      role: profile.role as any,
      email: profile.email,
      name: profile.name,
      careType: profile.care_type,
      doctorId: profile.role === 'doctor' ? user.id : undefined
    }
  }, [user, profile])

  // Initialize filters from URL or role-based defaults
  const initializeFilters = useCallback((): ScheduleFilter => {
    // 1. Try URL params first (highest priority)
    if (persistToUrl) {
      const careTypesParam = searchParams.get('careTypes')
      const doctorIdParam = searchParams.get('doctorId')
      const showAllParam = searchParams.get('showAll')
      const viewModeParam = searchParams.get('viewMode')

      if (careTypesParam || doctorIdParam || showAllParam) {
        return {
          ...defaultFilters,
          department_ids: careTypesParam
            ? careTypesParam.split(',').filter(t =>
                ['외래', '입원', '낮병원'].includes(t))
            : [],
          doctorId: doctorIdParam || null,
          showAll: showAllParam === 'true',
          viewMode: (viewModeParam as 'my' | 'all') || 'my'
        }
      }
    }

    // 2. Use role-based defaults
    if (userContext) {
      return RoleBasedFilterManager.getInitialFilters(userContext)
    }

    // 3. Fallback to system defaults
    return defaultFilters
  }, [persistToUrl, searchParams, userContext])

  // State
  const [filters, setFiltersInternal] = useState<ScheduleFilter>(defaultFilters)
  const [isLoading, setIsLoading] = useState(false)
  const [optimisticFilters, setOptimisticFilters] = useState<ScheduleFilter | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)

  // Initialize persistence layer and filters when user context is ready
  useEffect(() => {
    if (!userContext || isInitializedRef.current) return

    let cancelled = false

    const initializeAsync = async () => {
      let initialFilters: ScheduleFilter | null = null

      // Initialize persistence
      if (enablePersistence) {
        persistenceRef.current = new FilterPersistence(userContext.id, userContext.role)

        // Try to load persisted filters first
        initialFilters = await persistenceRef.current.loadFilters()
      }

      // If cancelled during async operation, bail out
      if (cancelled) return

      // Use persisted filters if available, otherwise use initialization logic
      const resolved = initialFilters ?? initializeFilters()
      setFiltersInternal(resolved)
      isInitializedRef.current = true
    }

    initializeAsync()

    // Setup multi-tab sync after initialization
    const setupSync = () => {
      if (enableMultiTab && persistenceRef.current) {
        return persistenceRef.current.onFilterChange((newFilters) => {
          console.log('[FilterProvider] Received filter change from other tab:', newFilters)
          setFiltersInternal(newFilters)
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['schedules'] })
        })
      }
      return () => {}
    }

    const unsubscribe = setupSync()

    return () => {
      cancelled = true
      unsubscribe()
      persistenceRef.current?.destroy()
    }
  }, [userContext, enablePersistence, enableMultiTab, queryClient, initializeFilters])

  // Sync filters to URL when they change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncFiltersToUrl = useCallback(
    debounce((filters: ScheduleFilter) => {
      if (!persistToUrl) return

      const params = new URLSearchParams(searchParams)

      // Update URL params based on filters
      if (filters.department_ids.length > 0) {
        params.set('careTypes', filters.department_ids.join(','))
      } else {
        params.delete('careTypes')
      }

      if (filters.doctorId) {
        params.set('doctorId', filters.doctorId)
      } else {
        params.delete('doctorId')
      }

      if (filters.showAll !== undefined) {
        params.set('showAll', filters.showAll.toString())
      } else {
        params.delete('showAll')
      }

      if (filters.viewMode) {
        params.set('viewMode', filters.viewMode)
      } else {
        params.delete('viewMode')
      }

      // Only update URL if params actually changed
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      if (newUrl !== `${pathname}${window.location.search}`) {
        router.replace(newUrl)
      }
    }, 300),
    [persistToUrl, pathname, router, searchParams]
  )

  // Persist and sync filters when they change
  useEffect(() => {
    syncFiltersToUrl(filters)

    // Persist to storage
    if (enablePersistence && persistenceRef.current) {
      persistenceRef.current.saveFilters(filters, {
        modifiedBy: 'user'
      })
    }
  }, [filters, syncFiltersToUrl, enablePersistence])

  // Enhanced setFilters with validation and optimistic updates
  const setFilters = useCallback((newFilters: ScheduleFilter | ((prev: ScheduleFilter) => ScheduleFilter)) => {
    const resolvedFilters = typeof newFilters === 'function' ? newFilters(filters) : newFilters

    if (!userContext) {
      setFiltersInternal(resolvedFilters)
      return
    }

    // Validate filter change
    const validation = RoleBasedFilterManager.validateFilterChange(resolvedFilters, userContext)
    if (!validation.valid) {
      setFilterError(validation.reason || '필터 변경이 허용되지 않습니다')
      return
    }

    // Store previous state for rollback
    previousFiltersRef.current = filters

    // Apply optimistic update
    setOptimisticFilters(resolvedFilters)
    setFiltersInternal(resolvedFilters)
    setFilterError(null)

    // Clear optimistic state after a delay
    setTimeout(() => {
      setOptimisticFilters(null)
    }, 500)
  }, [userContext, filters])

  // Update filters (partial update)
  const updateFilters = useCallback((updates: Partial<ScheduleFilter>) => {
    setFilters((prev: ScheduleFilter) => ({
      ...prev,
      ...updates
    }))
  }, [setFilters])

  // Reset all filters to role-based defaults
  const resetFilters = useCallback(() => {
    if (userContext) {
      const defaultFilters = RoleBasedFilterManager.getInitialFilters(userContext)
      setFilters(defaultFilters)
    } else {
      setFilters(defaultFilters)
    }

    // Clear persisted state
    if (enablePersistence && persistenceRef.current) {
      persistenceRef.current.clearFilters('all')
    }
  }, [userContext, setFilters, enablePersistence])

  // Toggle between "my" and "all" view modes
  const toggleViewMode = useCallback(() => {
    if (!userContext) return

    const newFilters = RoleBasedFilterManager.toggleViewMode(filters, userContext)
    setFilters(newFilters)

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }, [filters, userContext, setFilters, queryClient])

  // Toggle a care type
  const toggleCareType = useCallback((careType: CareType) => {
    setFilters((prev: ScheduleFilter) => {
      const currentTypes = [...prev.department_ids]
      const index = currentTypes.indexOf(careType)

      if (index > -1) {
        currentTypes.splice(index, 1)
      } else {
        currentTypes.push(careType)
      }

      return {
        ...prev,
        department_ids: currentTypes
      }
    })
  }, [setFilters])

  // Toggle a department (multi-select support)
  const toggleDepartment = useCallback((departmentId: string) => {
    setFilters((prev: ScheduleFilter) => {
      const currentDepartments = [...prev.department_ids]
      const index = currentDepartments.indexOf(departmentId)

      if (index > -1) {
        currentDepartments.splice(index, 1)
      } else {
        currentDepartments.push(departmentId)
      }

      return {
        ...prev,
        department_ids: currentDepartments
      }
    })
  }, [setFilters])

  // Rollback to previous filters (for error recovery)
  const rollbackFilters = useCallback(() => {
    if (previousFiltersRef.current) {
      setFiltersInternal(previousFiltersRef.current)
      setOptimisticFilters(null)
    }
  }, [])

  // Get filter summary text
  const getFilterSummary = useCallback((counts?: { total: number; filtered: number }) => {
    if (!userContext) return ''
    return RoleBasedFilterManager.getFilterSummary(filters, userContext, counts)
  }, [filters, userContext])

  // Get available filter options
  const filterOptions = useMemo(() => {
    if (!userContext) return null
    return RoleBasedFilterManager.getAvailableFilterOptions(userContext)
  }, [userContext])

  // Get filter presets
  const filterPresets = useMemo(() => {
    if (!userContext) return []
    return RoleBasedFilterManager.getFilterPresets(userContext)
  }, [userContext])

  // Apply a preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = filterPresets.find(p => p.id === presetId)
    if (preset) {
      updateFilters(preset.filters)
    }
  }, [filterPresets, updateFilters])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return checkHasActiveFilters(filters)
  }, [filters])

  // Export filter state (for debugging)
  const exportFilterState = useCallback(() => {
    if (!persistenceRef.current) return null
    return persistenceRef.current.exportState()
  }, [])

  // Context value with all enhanced features
  const contextValue = useMemo(() => ({
    // Core state
    filters: optimisticFilters || filters,
    isOptimistic: !!optimisticFilters,
    filterError,

    // Core actions
    updateFilters,
    resetFilters,
    toggleCareType,
    toggleDepartment,
    toggleViewMode,
    rollbackFilters,

    // Enhanced features
    applyPreset,
    getFilterSummary,
    exportFilterState,

    // Metadata
    hasActiveFilters,
    isLoading,
    filterOptions,
    filterPresets,
    userContext
  }), [
    filters,
    optimisticFilters,
    filterError,
    updateFilters,
    resetFilters,
    toggleCareType,
    toggleDepartment,
    toggleViewMode,
    rollbackFilters,
    applyPreset,
    getFilterSummary,
    exportFilterState,
    hasActiveFilters,
    isLoading,
    filterOptions,
    filterPresets,
    userContext
  ])

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  )
}