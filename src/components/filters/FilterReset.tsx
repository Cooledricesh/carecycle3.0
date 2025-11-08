'use client'

import { useFilterContext } from '@/lib/filters/filter-context'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterResetProps {
  size?: 'sm' | 'default' | 'lg'
  variant?: 'outline' | 'ghost' | 'default'
  className?: string
  showIcon?: boolean
  showBadge?: boolean
}

export function FilterReset({
  size = 'sm',
  variant = 'outline',
  className,
  showIcon = true,
  showBadge = true
}: FilterResetProps) {
  const { hasActiveFilters, resetFilters, filters } = useFilterContext()

  if (!hasActiveFilters) {
    return null
  }

  const activeFilterCount =
    filters.department_ids.length +
    (filters.doctorId ? 1 : 0) +
    (filters.dateRange ? 1 : 0)

  return (
    <Button
      onClick={resetFilters}
      size={size}
      variant={variant}
      className={cn('gap-2', className)}
      aria-label="모든 필터 초기화"
    >
      {showIcon && <RotateCcw className="h-3.5 w-3.5" />}
      필터 초기화
      {showBadge && activeFilterCount > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
          {activeFilterCount}
        </span>
      )}
    </Button>
  )
}