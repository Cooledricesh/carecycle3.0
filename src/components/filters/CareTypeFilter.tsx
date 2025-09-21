'use client'

import { useFilterContext } from '@/lib/filters/filter-context'
import { careTypeLabels, careTypeColors, type CareType } from '@/lib/filters/filter-types'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export function CareTypeFilter() {
  const { filters, toggleCareType } = useFilterContext()

  const careTypes: CareType[] = ['외래', '입원', '낮병원']

  return (
    <div className="flex flex-wrap gap-2">
      {careTypes.map((careType) => {
        const isSelected = filters.careTypes.includes(careType)
        const colors = careTypeColors[careType]

        return (
          <button
            key={careType}
            onClick={() => toggleCareType(careType)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              'flex items-center gap-1.5 border',
              'hover:shadow-sm active:scale-95',
              isSelected
                ? colors
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
            )}
            aria-pressed={isSelected}
            aria-label={`${careTypeLabels[careType]} 필터 ${isSelected ? '해제' : '적용'}`}
          >
            {isSelected && <Check className="h-3 w-3" />}
            {careTypeLabels[careType]}
          </button>
        )
      })}
    </div>
  )
}

// Mobile version with larger touch targets
export function CareTypeFilterMobile() {
  const { filters, toggleCareType } = useFilterContext()

  const careTypes: CareType[] = ['외래', '입원', '낮병원']

  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {careTypes.map((careType) => {
        const isSelected = filters.careTypes.includes(careType)
        const colors = careTypeColors[careType]

        return (
          <button
            key={careType}
            onClick={() => toggleCareType(careType)}
            className={cn(
              'px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              'flex items-center justify-center gap-1.5 border min-h-[44px]',
              'hover:shadow-sm active:scale-95',
              isSelected
                ? colors
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
            )}
            aria-pressed={isSelected}
            aria-label={`${careTypeLabels[careType]} 필터 ${isSelected ? '해제' : '적용'}`}
          >
            {isSelected && <Check className="h-3 w-3" />}
            {careTypeLabels[careType]}
          </button>
        )
      })}
    </div>
  )
}