'use client'

import type { ScheduleFilter } from './filter-types'

export type UserRole = 'doctor' | 'nurse' | 'admin'

export interface UserContext {
  id: string
  role: UserRole
  email: string
  name: string
  careType?: string | null // For nurses
  doctorId?: string // For doctors (same as user id)
}

/**
 * Role-Based Filter Manager
 *
 * Provides intelligent default filters based on user role and context
 * Handles filter state transitions when switching between modes
 */
export class RoleBasedFilterManager {
  /**
   * Get initial filters based on user role and context
   */
  static getInitialFilters(user: UserContext): ScheduleFilter {
    switch (user.role) {
      case 'doctor':
        return {
          careTypes: [],
          doctorId: user.id, // Filter to own patients by default
          department: null,
          dateRange: null,
          includeInactive: false,
          showAll: false, // Start with "my patients" view
          viewMode: 'my'
        }

      case 'nurse':
        // Nurses see their department patients by default
        const nurseFilters: ScheduleFilter = {
          careTypes: user.careType ? [user.careType as any] : [],
          doctorId: null,
          department: user.careType,
          dateRange: null,
          includeInactive: false,
          showAll: false, // Start with department view
          viewMode: 'my'
        }
        return nurseFilters

      case 'admin':
        // Admins see everything by default
        return {
          careTypes: [], // Empty = all types
          doctorId: null,
          department: null,
          dateRange: null,
          includeInactive: false,
          showAll: true, // Admins always see all
          viewMode: 'all'
        }

      default:
        // Fallback to most restrictive
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
  }

  /**
   * Toggle between "my" and "all" view modes
   */
  static toggleViewMode(
    currentFilters: ScheduleFilter,
    user: UserContext
  ): ScheduleFilter {
    const newShowAll = !currentFilters.showAll
    const newViewMode = newShowAll ? 'all' : 'my'

    switch (user.role) {
      case 'doctor':
        return {
          ...currentFilters,
          showAll: newShowAll,
          viewMode: newViewMode,
          // When toggling to "all", remove doctor filter
          // When toggling to "my", add doctor filter back
          doctorId: newShowAll ? null : user.id
        }

      case 'nurse':
        return {
          ...currentFilters,
          showAll: newShowAll,
          viewMode: newViewMode,
          // When toggling to "all", clear department filter
          // When toggling to "my", restore department filter
          department: newShowAll ? null : user.careType,
          careTypes: newShowAll ? [] : (user.careType ? [user.careType as any] : [])
        }

      case 'admin':
        // Admins don't really toggle - they always see all
        return currentFilters

      default:
        return currentFilters
    }
  }

  /**
   * Get filter summary text for UI display
   */
  static getFilterSummary(
    filters: ScheduleFilter,
    user: UserContext,
    counts?: { total: number; filtered: number }
  ): string {
    const parts: string[] = []

    // Role-specific summaries
    switch (user.role) {
      case 'doctor':
        if (filters.showAll) {
          parts.push('전체 환자')
        } else {
          parts.push('내 환자')
        }
        break

      case 'nurse':
        if (filters.showAll) {
          parts.push('전체 환자')
        } else if (filters.department) {
          parts.push(`${filters.department} 환자`)
        } else {
          parts.push('소속 부서 환자')
        }
        break

      case 'admin':
        if (filters.careTypes.length > 0) {
          parts.push(filters.careTypes.join(', '))
        } else {
          parts.push('전체')
        }
        break
    }

    // Add count if provided
    if (counts) {
      parts.push(`(${counts.filtered}/${counts.total}명)`)
    }

    return parts.join(' ')
  }

  /**
   * Check if user can modify filters
   */
  static canModifyFilters(user: UserContext): boolean {
    // All roles can modify filters, but with different options
    return true
  }

  /**
   * Get available filter options for user
   */
  static getAvailableFilterOptions(user: UserContext): {
    canToggleViewMode: boolean
    canFilterByCareType: boolean
    canFilterByDoctor: boolean
    canFilterByDateRange: boolean
    canFilterByStatus: boolean
  } {
    switch (user.role) {
      case 'doctor':
        return {
          canToggleViewMode: true, // Can toggle between "my" and "all"
          canFilterByCareType: false, // Hidden for doctors
          canFilterByDoctor: false, // Automatic based on view mode
          canFilterByDateRange: true,
          canFilterByStatus: true
        }

      case 'nurse':
        return {
          canToggleViewMode: true, // Can toggle between department and all
          canFilterByCareType: true, // Can use advanced filters
          canFilterByDoctor: false,
          canFilterByDateRange: true,
          canFilterByStatus: true
        }

      case 'admin':
        return {
          canToggleViewMode: false, // Always see all
          canFilterByCareType: true, // Full filter access
          canFilterByDoctor: true,
          canFilterByDateRange: true,
          canFilterByStatus: true
        }

      default:
        return {
          canToggleViewMode: false,
          canFilterByCareType: false,
          canFilterByDoctor: false,
          canFilterByDateRange: false,
          canFilterByStatus: false
        }
    }
  }

  /**
   * Validate filter changes for role
   */
  static validateFilterChange(
    newFilters: ScheduleFilter,
    user: UserContext
  ): { valid: boolean; reason?: string } {
    const options = this.getAvailableFilterOptions(user)

    // Check if user is trying to use disabled filters
    if (!options.canFilterByCareType && newFilters.careTypes.length > 0) {
      return {
        valid: false,
        reason: '진료 구분 필터를 사용할 수 없습니다'
      }
    }

    if (!options.canFilterByDoctor && newFilters.doctorId &&
        newFilters.doctorId !== user.id) {
      return {
        valid: false,
        reason: '다른 의사의 환자를 필터링할 수 없습니다'
      }
    }

    return { valid: true }
  }

  /**
   * Handle role change (e.g., admin impersonating another role)
   */
  static handleRoleChange(
    previousRole: UserRole,
    newRole: UserRole,
    user: UserContext
  ): ScheduleFilter {
    // Reset to new role's defaults
    return this.getInitialFilters({ ...user, role: newRole })
  }

  /**
   * Get filter presets for quick selection
   */
  static getFilterPresets(user: UserContext): Array<{
    id: string
    name: string
    icon?: string
    filters: Partial<ScheduleFilter>
  }> {
    const basePresets = [
      {
        id: 'today',
        name: '오늘',
        icon: 'calendar-today',
        filters: {
          dateRange: {
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          }
        }
      },
      {
        id: 'this-week',
        name: '이번 주',
        icon: 'calendar-week',
        filters: {
          dateRange: {
            start: getWeekStart(),
            end: getWeekEnd()
          }
        }
      }
    ]

    // Role-specific presets
    switch (user.role) {
      case 'doctor':
        return [
          {
            id: 'my-patients',
            name: '내 환자',
            icon: 'user-check',
            filters: {
              doctorId: user.id,
              showAll: false,
              viewMode: 'my'
            }
          },
          ...basePresets
        ]

      case 'nurse':
        return [
          {
            id: 'my-department',
            name: '우리 부서',
            icon: 'building',
            filters: {
              department: user.careType,
              careTypes: user.careType ? [user.careType as any] : [],
              showAll: false,
              viewMode: 'my'
            }
          },
          ...basePresets
        ]

      case 'admin':
        return [
          {
            id: 'all',
            name: '전체',
            icon: 'eye',
            filters: {
              careTypes: [],
              doctorId: null,
              department: null
            }
          },
          {
            id: 'outpatient',
            name: '외래만',
            icon: 'hospital',
            filters: {
              careTypes: ['외래']
            }
          },
          {
            id: 'inpatient',
            name: '입원만',
            icon: 'bed',
            filters: {
              careTypes: ['입원']
            }
          },
          ...basePresets
        ]

      default:
        return basePresets
    }
  }
}

// Helper functions
function getWeekStart(): string {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff)).toISOString().split('T')[0]
}

function getWeekEnd(): string {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + 7
  return new Date(date.setDate(diff)).toISOString().split('T')[0]
}