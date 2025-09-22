'use client'

import type { ScheduleFilter } from './filter-types'

/**
 * Filter Recovery and Edge Case Handler
 *
 * Handles various edge cases and provides recovery mechanisms for:
 * - Corrupted filter state
 * - Network failures during sync
 * - Browser storage quota exceeded
 * - Conflicting multi-tab updates
 * - User role changes mid-session
 */

export interface RecoveryContext {
  userId: string
  role: string
  timestamp: string
  source: 'storage' | 'url' | 'broadcast' | 'manual'
}

export interface RecoveryResult {
  success: boolean
  filters?: ScheduleFilter
  action: 'recovered' | 'reset' | 'merged' | 'ignored'
  message: string
}

export class FilterRecoveryManager {
  private static readonly MAX_RETRY_ATTEMPTS = 3
  private static readonly CONFLICT_RESOLUTION_TIMEOUT = 5000 // 5 seconds

  /**
   * Recover from corrupted filter state
   */
  static recoverFromCorruption(
    corruptedData: any,
    context: RecoveryContext
  ): RecoveryResult {
    try {
      // Attempt to salvage valid fields
      const recovered: Partial<ScheduleFilter> = {}

      // Safely extract arrays
      if (Array.isArray(corruptedData?.careTypes)) {
        recovered.careTypes = corruptedData.careTypes.filter(
          (t: any) => ['외래', '입원', '낮병원'].includes(t)
        )
      } else {
        recovered.careTypes = []
      }

      // Safely extract strings
      recovered.doctorId = typeof corruptedData?.doctorId === 'string'
        ? corruptedData.doctorId
        : null

      recovered.department = typeof corruptedData?.department === 'string'
        ? corruptedData.department
        : null

      // Safely extract booleans
      recovered.includeInactive = corruptedData?.includeInactive === true
      recovered.showAll = corruptedData?.showAll === true

      // Validate recovered state
      if (this.isValidFilterState(recovered)) {
        return {
          success: true,
          filters: recovered as ScheduleFilter,
          action: 'recovered',
          message: '필터 상태가 복구되었습니다'
        }
      }

      // If recovery failed, return to defaults
      return this.resetToDefaults(context)
    } catch (error) {
      console.error('[FilterRecovery] Recovery failed:', error)
      return this.resetToDefaults(context)
    }
  }

  /**
   * Handle storage quota exceeded
   */
  static handleQuotaExceeded(context: RecoveryContext): RecoveryResult {
    try {
      // Clear old filter states from storage
      this.clearOldFilterStates(context.userId)

      // Try to compact current state
      const compacted = this.compactFilterState()

      return {
        success: true,
        filters: compacted,
        action: 'recovered',
        message: '저장 공간을 정리했습니다'
      }
    } catch (error) {
      return {
        success: false,
        action: 'ignored',
        message: '저장 공간 부족으로 필터를 저장할 수 없습니다'
      }
    }
  }

  /**
   * Resolve conflicting filter updates from multiple tabs
   */
  static resolveConflict(
    localFilters: ScheduleFilter,
    remoteFilters: ScheduleFilter,
    context: RecoveryContext
  ): RecoveryResult {
    // Strategy: Last-write-wins with merge for non-conflicting fields
    try {
      const merged: ScheduleFilter = {
        // Take remote values for single-value fields (last write wins)
        showAll: remoteFilters.showAll,
        viewMode: remoteFilters.viewMode,
        doctorId: remoteFilters.doctorId,
        department: remoteFilters.department,

        // Merge arrays (union of both)
        careTypes: Array.from(new Set([
          ...localFilters.careTypes,
          ...remoteFilters.careTypes
        ])) as any,

        // Keep local values for user-specific settings
        includeInactive: localFilters.includeInactive,
        dateRange: localFilters.dateRange || remoteFilters.dateRange
      }

      return {
        success: true,
        filters: merged,
        action: 'merged',
        message: '다른 탭의 변경사항과 병합되었습니다'
      }
    } catch (error) {
      // On merge failure, prefer remote (newer) state
      return {
        success: true,
        filters: remoteFilters,
        action: 'recovered',
        message: '다른 탭의 필터 설정을 사용합니다'
      }
    }
  }

  /**
   * Handle user role change during session
   */
  static handleRoleChange(
    oldRole: string,
    newRole: string,
    currentFilters: ScheduleFilter,
    context: RecoveryContext
  ): RecoveryResult {
    // Clear role-specific filters
    const sanitized: ScheduleFilter = {
      ...currentFilters,
      // Reset role-specific fields
      doctorId: null,
      department: null,
      showAll: false,
      viewMode: 'my',
      // Keep general filters
      careTypes: [],
      dateRange: currentFilters.dateRange,
      includeInactive: false
    }

    return {
      success: true,
      filters: sanitized,
      action: 'reset',
      message: `역할이 ${oldRole}에서 ${newRole}로 변경되어 필터가 초기화되었습니다`
    }
  }

  /**
   * Recover from network failure during sync
   */
  static async recoverFromSyncFailure(
    filters: ScheduleFilter,
    context: RecoveryContext,
    retryCount: number = 0
  ): Promise<RecoveryResult> {
    if (retryCount >= this.MAX_RETRY_ATTEMPTS) {
      return {
        success: false,
        filters,
        action: 'ignored',
        message: '동기화 실패 - 로컬 상태를 유지합니다'
      }
    }

    try {
      // Store in local queue for retry
      this.queueForRetry(filters, context)

      return {
        success: true,
        filters,
        action: 'recovered',
        message: '동기화가 대기열에 추가되었습니다'
      }
    } catch (error) {
      // Retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
      return this.recoverFromSyncFailure(filters, context, retryCount + 1)
    }
  }

  /**
   * Validate filter state integrity
   */
  private static isValidFilterState(filters: any): boolean {
    if (!filters || typeof filters !== 'object') return false

    // Check required fields
    if (!Array.isArray(filters.careTypes)) return false

    // Check field types
    if (filters.doctorId !== null && typeof filters.doctorId !== 'string') return false
    if (filters.department !== null && typeof filters.department !== 'string') return false

    // Check boolean fields
    if (typeof filters.includeInactive !== 'boolean') return false
    if (typeof filters.showAll !== 'boolean') return false

    return true
  }

  /**
   * Reset to default filters
   */
  private static resetToDefaults(context: RecoveryContext): RecoveryResult {
    return {
      success: true,
      filters: {
        careTypes: [],
        doctorId: null,
        department: null,
        dateRange: null,
        includeInactive: false,
        showAll: false,
        viewMode: 'my'
      },
      action: 'reset',
      message: '필터가 기본값으로 초기화되었습니다'
    }
  }

  /**
   * Clear old filter states from storage
   */
  private static clearOldFilterStates(userId: string): void {
    if (typeof localStorage === 'undefined') return

    const keysToRemove: string[] = []
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

    // Find old filter states
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('filters_') && key.includes(userId)) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            const age = now - new Date(parsed.timestamp).getTime()
            if (age > maxAge) {
              keysToRemove.push(key)
            }
          }
        } catch {
          // Remove corrupted entries
          keysToRemove.push(key)
        }
      }
    }

    // Remove old states
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  /**
   * Compact filter state to save space
   */
  private static compactFilterState(): ScheduleFilter {
    return {
      careTypes: [],
      doctorId: null,
      department: null,
      dateRange: null,
      includeInactive: false,
      showAll: false,
      viewMode: 'my'
    }
  }

  /**
   * Queue filters for retry
   */
  private static queueForRetry(filters: ScheduleFilter, context: RecoveryContext): void {
    if (typeof localStorage === 'undefined') return

    const queueKey = `filter_sync_queue_${context.userId}`
    const queue = this.getRetryQueue(context.userId)

    queue.push({
      filters,
      context,
      timestamp: new Date().toISOString(),
      attempts: 0
    })

    // Keep only last 10 items in queue
    if (queue.length > 10) {
      queue.splice(0, queue.length - 10)
    }

    localStorage.setItem(queueKey, JSON.stringify(queue))
  }

  /**
   * Get retry queue
   */
  private static getRetryQueue(userId: string): any[] {
    if (typeof localStorage === 'undefined') return []

    const queueKey = `filter_sync_queue_${userId}`
    try {
      const data = localStorage.getItem(queueKey)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /**
   * Process retry queue
   */
  static async processRetryQueue(
    userId: string,
    syncFunction: (filters: ScheduleFilter) => Promise<boolean>
  ): Promise<void> {
    const queue = this.getRetryQueue(userId)
    if (queue.length === 0) return

    const queueKey = `filter_sync_queue_${userId}`
    const processedItems: any[] = []

    for (const item of queue) {
      try {
        const success = await syncFunction(item.filters)
        if (!success) {
          item.attempts++
          if (item.attempts < this.MAX_RETRY_ATTEMPTS) {
            processedItems.push(item)
          }
        }
      } catch {
        item.attempts++
        if (item.attempts < this.MAX_RETRY_ATTEMPTS) {
          processedItems.push(item)
        }
      }
    }

    // Update queue with unprocessed items
    if (processedItems.length > 0) {
      localStorage.setItem(queueKey, JSON.stringify(processedItems))
    } else {
      localStorage.removeItem(queueKey)
    }
  }
}

/**
 * Hook to use filter recovery
 */
export function useFilterRecovery(userId: string, role: string) {
  const contextRef = React.useRef<RecoveryContext>({
    userId,
    role,
    timestamp: new Date().toISOString(),
    source: 'manual'
  })

  React.useEffect(() => {
    contextRef.current.userId = userId
    contextRef.current.role = role
  }, [userId, role])

  const recover = React.useCallback((
    error: any,
    currentFilters: ScheduleFilter
  ): RecoveryResult => {
    // Determine recovery strategy based on error type
    if (error?.message?.includes('quota')) {
      return FilterRecoveryManager.handleQuotaExceeded(contextRef.current)
    }

    if (error?.message?.includes('corrupt')) {
      return FilterRecoveryManager.recoverFromCorruption(
        currentFilters,
        contextRef.current
      )
    }

    // Default recovery
    return FilterRecoveryManager.recoverFromCorruption(
      currentFilters,
      contextRef.current
    )
  }, [])

  return { recover }
}