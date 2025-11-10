'use client'

import { DepartmentFilterDropdown, DepartmentFilterDropdownMobile } from './DepartmentFilterDropdown'
import { SimpleFilterToggle, SimpleFilterToggleMobile } from './SimpleFilterToggle'
import { FilterReset } from './FilterReset'
import { useFilterContext } from '@/lib/filters/filter-context'
import { useProfile, Profile } from '@/hooks/useProfile'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'

interface FilterBarProps {
  className?: string
  showTitle?: boolean
  collapsible?: boolean
}

export function FilterBar({
  className,
  showTitle = true,
  collapsible = false
}: FilterBarProps) {
  const isMobile = useIsMobile()
  const { hasActiveFilters, filters } = useFilterContext()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const [isOpen, setIsOpen] = useState(!collapsible)

  const activeFilterCount =
    filters.department_ids.length +
    (filters.doctorId ? 1 : 0) +
    (filters.dateRange ? 1 : 0) +
    (filters.showAll ? 1 : 0)

  // Role-based UI differentiation
  const renderFilterContent = () => {
    if (!typedProfile) {
      return null
    }

    // Doctor: Simple toggle only
    if (typedProfile.role === 'doctor') {
      return (
        <div className={cn(
          'flex items-center gap-3',
          isMobile && 'flex-col items-start w-full'
        )}>
          {isMobile ? (
            <SimpleFilterToggleMobile className="w-full" />
          ) : (
            <SimpleFilterToggle />
          )}

          {/* Reset button if there are other active filters */}
          {hasActiveFilters && !filters.showAll && (
            <div className={cn(
              'ml-auto',
              isMobile && 'ml-0 w-full flex justify-center mt-2'
            )}>
              <FilterReset
                size={isMobile ? 'default' : 'sm'}
                className={isMobile ? 'w-full' : ''}
              />
            </div>
          )}
        </div>
      )
    }

    // Nurse: Simple toggle only (same as doctor)
    if (typedProfile.role === 'nurse') {
      return (
        <div className={cn(
          'flex items-center gap-3',
          isMobile && 'flex-col items-start w-full'
        )}>
          {isMobile ? (
            <SimpleFilterToggleMobile className="w-full" />
          ) : (
            <SimpleFilterToggle />
          )}

          {/* Reset button if there are other active filters */}
          {hasActiveFilters && !filters.showAll && (
            <div className={cn(
              'ml-auto',
              isMobile && 'ml-0 w-full flex justify-center mt-2'
            )}>
              <FilterReset
                size={isMobile ? 'default' : 'sm'}
                className={isMobile ? 'w-full' : ''}
              />
            </div>
          )}
        </div>
      )
    }

    // Admin: Full filter controls
    return (
      <div className={cn(
        'flex items-center gap-3',
        isMobile && 'flex-col items-start w-full'
      )}>
        {/* Department Filter */}
        <div className={cn(
          'flex items-center gap-2',
          isMobile && 'w-full'
        )}>
          {!isMobile && showTitle && (
            <span className="text-sm font-medium text-gray-600">소속:</span>
          )}
          {isMobile ? <DepartmentFilterDropdownMobile /> : <DepartmentFilterDropdown />}
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <div className={cn(
            'ml-auto',
            isMobile && 'ml-0 w-full flex justify-center'
          )}>
            <FilterReset
              size={isMobile ? 'default' : 'sm'}
              className={isMobile ? 'w-full' : ''}
            />
          </div>
        )}
      </div>
    )
  }

  const content = renderFilterContent()

  if (!collapsible) {
    return (
      <div className={cn(
        'p-3 bg-gray-50 border rounded-lg',
        className
      )}>
        {content}
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        'bg-gray-50 border rounded-lg',
        className
      )}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">필터</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-600 transition-transform duration-200',
                isOpen && 'transform rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="p-3 pt-0 border-t">
          {content}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Compact version for embedding in other components
export function FilterBarCompact({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DepartmentFilterDropdown />
      <FilterReset size="sm" showBadge={false} />
    </div>
  )
}