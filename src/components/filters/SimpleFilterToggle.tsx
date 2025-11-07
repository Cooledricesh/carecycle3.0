'use client'

import { cn } from '@/lib/utils'
import { useFilterContext } from '@/lib/filters/filter-context'
import { useProfile, Profile } from '@/hooks/useProfile'
import { Users, User, AlertCircle } from 'lucide-react'
import { useFilteredPatientCount } from '@/hooks/useFilteredPatientCount'
import { useFilterStatistics } from '@/hooks/useFilterStatistics'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'

interface SimpleFilterToggleProps {
  className?: string
  onToggle?: (showAll: boolean) => void
}

export function SimpleFilterToggle({ className, onToggle }: SimpleFilterToggleProps) {
  const { filters, updateFilters } = useFilterContext()
  const { data: profile, isLoading } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  // Get filtered patient counts
  const { myPatientCount, totalCount } = useFilteredPatientCount()

  // Use the new hook for statistics
  const { statistics, urgentCount } = useFilterStatistics(typedProfile)

  if (isLoading || !typedProfile) {
    return null
  }

  // Admin doesn't need simple toggle - they use full filters
  if (typedProfile.role === 'admin') {
    return null
  }

  const handleToggle = (showAll: boolean) => {
    // Clear cache when toggling to ensure fresh data
    scheduleServiceEnhanced.clearCache()

    updateFilters({ showAll })
    onToggle?.(showAll)
  }

  // Get display text based on role
  const getToggleText = () => {
    if (typedProfile.role === 'doctor') {
      return {
        my: '내 환자',
        all: '전체 환자',
        myCount: myPatientCount,
        allCount: totalCount
      }
    } else if (typedProfile.role === 'nurse') {
      const careTypeDisplay = typedProfile.care_type || '소속'
      // For nurses, show care_type patient count
      return {
        my: `${careTypeDisplay} 환자`,
        all: '전체 환자',
        myCount: myPatientCount,
        allCount: totalCount
      }
    }
    return { my: '필터', all: '전체', myCount: 0, allCount: 0 }
  }

  const toggleText = getToggleText()
  const isShowingAll = filters.showAll === true

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Mobile-optimized toggle buttons with 44px minimum touch target */}
      <div
        className="inline-flex rounded-lg bg-muted p-1"
        role="group"
        aria-label="필터 선택"
      >
        <button
          type="button"
          onClick={() => handleToggle(false)}
          className={cn(
            // 44px minimum height for touch target
            'min-h-[44px] px-4 py-2',
            'inline-flex items-center gap-2',
            'rounded-md text-sm font-medium',
            'transition-all duration-200',
            'touch-manipulation', // Optimize for touch
            !isShowingAll
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={!isShowingAll}
        >
          <User className="h-4 w-4" />
          <span>{toggleText.my}</span>
          <span className="text-xs text-muted-foreground">
            ({toggleText.myCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggle(true)}
          className={cn(
            // 44px minimum height for touch target
            'min-h-[44px] px-4 py-2',
            'inline-flex items-center gap-2',
            'rounded-md text-sm font-medium',
            'transition-all duration-200',
            'touch-manipulation', // Optimize for touch
            isShowingAll
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={isShowingAll}
        >
          <Users className="h-4 w-4" />
          <span>{toggleText.all}</span>
          <span className="text-xs text-muted-foreground">
            ({toggleText.allCount})
          </span>
        </button>
      </div>

      {/* Urgency indicator - always visible for medical safety */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-1">
          <div className={cn(
            'inline-flex items-center gap-1',
            'rounded-full px-2.5 py-1',
            'text-xs font-semibold',
            urgentCount > 5
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          )}>
            <AlertCircle className="h-3 w-3" />
            <span>긴급 {urgentCount}건</span>
          </div>
        </div>
      )}

      {/* Connection status indicator for real-time sync */}
      {typeof window !== 'undefined' && !navigator.onLine && (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-gray-400" />
          <span className="text-xs text-muted-foreground">오프라인</span>
        </div>
      )}
    </div>
  )
}

/**
 * Mobile-optimized version with vertical layout
 */
export function SimpleFilterToggleMobile({ className, onToggle }: SimpleFilterToggleProps) {
  const { filters, updateFilters } = useFilterContext()
  const { data: profile, isLoading } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  // Get filtered patient counts
  const { myPatientCount, totalCount } = useFilteredPatientCount()

  // Use the new hook for statistics
  const { statistics, urgentCount } = useFilterStatistics(typedProfile)

  if (isLoading || !typedProfile || typedProfile.role === 'admin') {
    return null
  }

  const handleToggle = (showAll: boolean) => {
    // Clear cache when toggling to ensure fresh data
    scheduleServiceEnhanced.clearCache()

    updateFilters({ showAll })
    onToggle?.(showAll)
  }

  const getToggleText = () => {
    if (typedProfile.role === 'doctor') {
      return {
        my: '내 환자만 보기',
        all: '모든 환자 보기',
        myCount: myPatientCount,
        allCount: totalCount
      }
    } else if (typedProfile.role === 'nurse') {
      const careTypeDisplay = typedProfile.care_type || '소속'
      return {
        my: `${careTypeDisplay} 환자만 보기`,
        all: '모든 환자 보기',
        myCount: myPatientCount,
        allCount: totalCount
      }
    }
    return { my: '필터', all: '전체', myCount: 0, allCount: 0 }
  }

  const toggleText = getToggleText()
  const isShowingAll = filters.showAll === true

  return (
    <div className={cn('w-full space-y-2', className)}>
      <button
        type="button"
        onClick={() => handleToggle(!isShowingAll)}
        className={cn(
          'w-full min-h-[56px]', // Larger touch target for mobile
          'flex items-center justify-between',
          'rounded-lg border-2 px-4 py-3',
          'transition-all duration-200',
          'touch-manipulation',
          isShowingAll
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white'
        )}
      >
        <div className="flex items-center gap-3">
          {isShowingAll ? (
            <Users className="h-5 w-5 text-blue-600" />
          ) : (
            <User className="h-5 w-5 text-gray-600" />
          )}
          <div className="text-left">
            <div className="font-medium">
              {isShowingAll ? toggleText.all : toggleText.my}
            </div>
            <div className="text-sm text-muted-foreground">
              {isShowingAll ? toggleText.allCount : toggleText.myCount}명 표시 중
            </div>
          </div>
        </div>

        <div className={cn(
          'rounded-full px-3 py-1',
          'text-xs font-medium',
          isShowingAll
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-700'
        )}>
          {isShowingAll ? '전체' : '내 담당'}
        </div>
      </button>

      {/* Urgent count as separate card on mobile */}
      {statistics && (statistics.overdueSchedules > 0 || statistics.todaySchedules > 0) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                긴급 처리 필요
              </span>
            </div>
            <div className="flex gap-3 text-sm">
              {statistics.overdueSchedules > 0 && (
                <span className="text-red-600 font-semibold">
                  지연 {statistics.overdueSchedules}
                </span>
              )}
              {statistics.todaySchedules > 0 && (
                <span className="text-amber-600 font-semibold">
                  오늘 {statistics.todaySchedules}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}