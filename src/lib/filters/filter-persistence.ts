'use client'

import React from 'react'
import { z } from 'zod'
import type { ScheduleFilter } from './filter-types'

/**
 * Filter Persistence Layer
 *
 * Handles multi-level state persistence with the following hierarchy:
 * 1. URL params (highest priority - for sharing/bookmarking)
 * 2. Session Storage (tab-specific state)
 * 3. Local Storage (cross-session persistence)
 * 4. Role-based defaults (fallback)
 */

// Version for migration handling
const FILTER_VERSION = 'v1.0.0'

// Storage keys with user context
const getStorageKey = (userId: string, role: string) => ({
  session: `filters_session_${role}_${userId}`,
  local: `filters_local_${role}_${userId}`,
  version: `filters_version_${userId}`
})

// Filter state schema for validation
const FilterStateSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  filters: z.object({
    careTypes: z.array(z.enum(['외래', '입원', '낮병원'])),
    doctorId: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).nullable().optional(),
    includeInactive: z.boolean().optional(),
    showAll: z.boolean().optional(),
    viewMode: z.enum(['my', 'all']).optional()
  }),
  metadata: z.object({
    lastModifiedBy: z.enum(['user', 'system', 'role_change']).optional(),
    syncedAt: z.string().optional()
  }).optional()
})

type FilterState = z.infer<typeof FilterStateSchema>

export class FilterPersistence {
  private userId: string
  private userRole: string
  private broadcastChannel: BroadcastChannel | null = null

  constructor(userId: string, userRole: string) {
    this.userId = userId
    this.userRole = userRole

    // Initialize broadcast channel for multi-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(`filters_sync_${userId}`)
    }
  }

  /**
   * Save filters to all persistence layers
   */
  async saveFilters(filters: ScheduleFilter, options?: {
    skipUrl?: boolean
    skipSession?: boolean
    skipLocal?: boolean
    modifiedBy?: 'user' | 'system' | 'role_change'
  }): Promise<void> {
    const keys = getStorageKey(this.userId, this.userRole)
    const state: FilterState = {
      version: FILTER_VERSION,
      timestamp: new Date().toISOString(),
      filters,
      metadata: {
        lastModifiedBy: options?.modifiedBy || 'user',
        syncedAt: new Date().toISOString()
      }
    }

    try {
      // Session Storage (tab-specific)
      if (!options?.skipSession && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(keys.session, JSON.stringify(state))
      }

      // Local Storage (persistent)
      if (!options?.skipLocal && typeof localStorage !== 'undefined') {
        localStorage.setItem(keys.local, JSON.stringify(state))
        localStorage.setItem(keys.version, FILTER_VERSION)
      }

      // Broadcast to other tabs
      this.broadcastFilterChange(filters)
    } catch (error) {
      console.error('[FilterPersistence] Error saving filters:', error)
    }
  }

  /**
   * Load filters with fallback hierarchy
   */
  async loadFilters(options?: {
    preferSession?: boolean
    ignoreUrl?: boolean
  }): Promise<ScheduleFilter | null> {
    const keys = getStorageKey(this.userId, this.userRole)

    try {
      // 1. Try Session Storage first (if preferred)
      if (options?.preferSession && typeof sessionStorage !== 'undefined') {
        const sessionData = sessionStorage.getItem(keys.session)
        if (sessionData) {
          const parsed = this.parseAndValidate(sessionData)
          if (parsed && this.isValidVersion(parsed.version)) {
            return parsed.filters
          }
        }
      }

      // 2. Try Local Storage
      if (typeof localStorage !== 'undefined') {
        const localData = localStorage.getItem(keys.local)
        if (localData) {
          const parsed = this.parseAndValidate(localData)
          if (parsed && this.isValidVersion(parsed.version)) {
            // Check if filters are still relevant (not stale)
            if (this.isFilterStateStale(parsed.timestamp)) {
              this.clearLocalFilters()
              return null
            }
            return parsed.filters
          }
        }
      }

      return null
    } catch (error) {
      console.error('[FilterPersistence] Error loading filters:', error)
      return null
    }
  }

  /**
   * Clear all persisted filter states
   */
  clearFilters(scope: 'all' | 'session' | 'local' = 'all'): void {
    const keys = getStorageKey(this.userId, this.userRole)

    if (scope === 'all' || scope === 'session') {
      sessionStorage.removeItem(keys.session)
    }

    if (scope === 'all' || scope === 'local') {
      localStorage.removeItem(keys.local)
      localStorage.removeItem(keys.version)
    }
  }

  /**
   * Broadcast filter changes to other tabs
   */
  private broadcastFilterChange(filters: ScheduleFilter): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'FILTER_CHANGE',
        filters,
        timestamp: new Date().toISOString(),
        userId: this.userId,
        role: this.userRole
      })
    }
  }

  /**
   * Listen for filter changes from other tabs
   */
  onFilterChange(callback: (filters: ScheduleFilter) => void): () => void {
    if (!this.broadcastChannel) {
      return () => {}
    }

    const handler = (event: MessageEvent) => {
      if (event.data.type === 'FILTER_CHANGE' &&
          event.data.userId === this.userId) {
        callback(event.data.filters)
      }
    }

    this.broadcastChannel.addEventListener('message', handler)

    // Return cleanup function
    return () => {
      this.broadcastChannel?.removeEventListener('message', handler)
    }
  }

  /**
   * Migrate filters from old version to new version
   */
  private migrateFilters(oldState: any): FilterState | null {
    try {
      // Handle v0 -> v1 migration
      if (!oldState.version) {
        return {
          version: FILTER_VERSION,
          timestamp: new Date().toISOString(),
          filters: {
            careTypes: oldState.careTypes || [],
            doctorId: oldState.doctorId || null,
            department: oldState.department || null,
            dateRange: oldState.dateRange || null,
            includeInactive: oldState.includeInactive || false,
            showAll: false, // New field, default to false
            viewMode: 'my' // New field, default to 'my'
          }
        }
      }

      // Future migrations would go here
      return oldState
    } catch {
      return null
    }
  }

  /**
   * Validate and parse filter state
   */
  private parseAndValidate(data: string): FilterState | null {
    try {
      const parsed = JSON.parse(data)

      // Try to migrate if needed
      const migrated = !parsed.version ? this.migrateFilters(parsed) : parsed

      // Validate with schema
      const validated = FilterStateSchema.safeParse(migrated)
      return validated.success ? validated.data : null
    } catch {
      return null
    }
  }

  /**
   * Check if version is compatible
   */
  private isValidVersion(version: string): boolean {
    // Simple version check - could be more sophisticated
    const [major] = version.split('.')
    const [currentMajor] = FILTER_VERSION.split('.')
    return major === currentMajor
  }

  /**
   * Check if filter state is stale (older than 30 days)
   */
  private isFilterStateStale(timestamp: string): boolean {
    const staleThreshold = 30 * 24 * 60 * 60 * 1000 // 30 days
    const age = Date.now() - new Date(timestamp).getTime()
    return age > staleThreshold
  }

  /**
   * Clear local storage filters
   */
  private clearLocalFilters(): void {
    const keys = getStorageKey(this.userId, this.userRole)
    localStorage.removeItem(keys.local)
  }

  /**
   * Export current filter state (for debugging/support)
   */
  exportState(): string {
    const keys = getStorageKey(this.userId, this.userRole)
    const state = {
      userId: this.userId,
      role: this.userRole,
      session: sessionStorage.getItem(keys.session),
      local: localStorage.getItem(keys.local),
      version: localStorage.getItem(keys.version),
      timestamp: new Date().toISOString()
    }
    return JSON.stringify(state, null, 2)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.broadcastChannel?.close()
    this.broadcastChannel = null
  }
}

/**
 * Hook to use filter persistence
 */
export function useFilterPersistence(userId: string, userRole: string) {
  const persistenceRef = React.useRef<FilterPersistence | undefined>(undefined)

  React.useEffect(() => {
    persistenceRef.current = new FilterPersistence(userId, userRole)

    return () => {
      persistenceRef.current?.destroy()
    }
  }, [userId, userRole])

  return persistenceRef.current
}