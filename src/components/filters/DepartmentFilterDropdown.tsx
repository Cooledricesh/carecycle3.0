'use client'

import { useFilterContext } from '@/lib/filters/filter-context'
import { useDepartments } from '@/hooks/useDepartments'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Department Filter Dropdown Component
 *
 * Features:
 * - Multi-select support with checkboxes
 * - "전체" option to clear all filters
 * - Dynamic department list from useDepartments hook
 * - Visual indicator when filters are active
 *
 * Phase 1: Uses care_type values as department IDs
 * Phase 2: Will seamlessly transition to departments.id (UUID)
 *
 * Usage:
 * ```tsx
 * <DepartmentFilterDropdown />
 * ```
 */
export function DepartmentFilterDropdown() {
  const { filters, toggleDepartment, updateFilters } = useFilterContext()
  const { data: departments, isLoading } = useDepartments()

  const selectedCount = filters.department_ids.length
  const hasSelection = selectedCount > 0

  const handleToggleDepartment = (departmentId: string) => {
    toggleDepartment(departmentId)
  }

  const handleSelectAll = () => {
    updateFilters({ department_ids: [] })
  }

  const buttonLabel = hasSelection
    ? `소속 (${selectedCount})`
    : '소속'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'min-w-[120px] justify-between gap-2',
            hasSelection && 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
          )}
          aria-label="소속 필터"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {buttonLabel}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>소속 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* "전체" option - clears all selections */}
        <DropdownMenuCheckboxItem
          checked={!hasSelection}
          onCheckedChange={handleSelectAll}
          className="font-medium"
        >
          전체
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Loading state */}
        {isLoading && (
          <div className="px-2 py-1.5 text-sm text-gray-500">
            로딩 중...
          </div>
        )}

        {/* No departments available */}
        {!isLoading && (!departments || departments.length === 0) && (
          <div className="px-2 py-1.5 text-sm text-gray-500">
            소속이 없습니다
          </div>
        )}

        {/* Department list */}
        {!isLoading && departments && departments.length > 0 && (
          departments.map((department) => (
            <DropdownMenuCheckboxItem
              key={department.id}
              checked={filters.department_ids.includes(department.id)}
              onCheckedChange={() => handleToggleDepartment(department.id)}
            >
              {department.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Mobile-optimized version with larger touch targets
 */
export function DepartmentFilterDropdownMobile() {
  const { filters, toggleDepartment, updateFilters } = useFilterContext()
  const { data: departments, isLoading } = useDepartments()

  const selectedCount = filters.department_ids.length
  const hasSelection = selectedCount > 0

  const handleToggleDepartment = (departmentId: string) => {
    toggleDepartment(departmentId)
  }

  const handleSelectAll = () => {
    updateFilters({ department_ids: [] })
  }

  const buttonLabel = hasSelection
    ? `소속 (${selectedCount})`
    : '소속'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full min-h-[44px] justify-between gap-2', // Minimum 44px for touch targets
            hasSelection && 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
          )}
          aria-label="소속 필터"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {buttonLabel}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-full min-w-[200px]">
        <DropdownMenuLabel>소속 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* "전체" option */}
        <DropdownMenuCheckboxItem
          checked={!hasSelection}
          onCheckedChange={handleSelectAll}
          className="font-medium min-h-[44px]"
        >
          전체
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Loading state */}
        {isLoading && (
          <div className="px-2 py-3 text-sm text-gray-500">
            로딩 중...
          </div>
        )}

        {/* No departments */}
        {!isLoading && (!departments || departments.length === 0) && (
          <div className="px-2 py-3 text-sm text-gray-500">
            소속이 없습니다
          </div>
        )}

        {/* Department list with larger touch targets */}
        {!isLoading && departments && departments.length > 0 && (
          departments.map((department) => (
            <DropdownMenuCheckboxItem
              key={department.id}
              checked={filters.department_ids.includes(department.id)}
              onCheckedChange={() => handleToggleDepartment(department.id)}
              className="min-h-[44px]"
            >
              {department.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
