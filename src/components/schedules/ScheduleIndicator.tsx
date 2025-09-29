'use client';

import { Check, AlertCircle, Clock, Calendar } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface ScheduleIndicatorProps {
  completedCount: number;
  overdueCount: number;
  scheduledCount?: number;
  totalCount?: number;
  size?: 'compact' | 'default' | 'large';
  showLabels?: boolean;
  className?: string;
}

export function ScheduleIndicator({
  completedCount,
  overdueCount,
  scheduledCount = 0,
  totalCount,
  size = 'default',
  showLabels = false,
  className = ''
}: ScheduleIndicatorProps) {
  const isMobile = useIsMobile();

  // Size-specific styles
  const sizeStyles = {
    compact: {
      container: 'gap-0.5',
      badge: 'px-1 py-0.5 text-xs',
      icon: 'h-2.5 w-2.5',
      font: 'text-xs'
    },
    default: {
      container: 'gap-1',
      badge: 'px-1.5 py-0.5 text-xs',
      icon: 'h-3 w-3',
      font: 'text-xs'
    },
    large: {
      container: 'gap-2',
      badge: 'px-2 py-1 text-sm',
      icon: 'h-4 w-4',
      font: 'text-sm'
    }
  };

  const styles = sizeStyles[size];
  const effectiveSize = isMobile && size === 'default' ? 'compact' : size;
  const effectiveStyles = sizeStyles[effectiveSize];

  // Don't show anything if all counts are 0
  if (completedCount === 0 && overdueCount === 0 && scheduledCount === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center ${effectiveStyles.container} ${className}`}
      role="group"
      aria-label={`정시 완료 ${completedCount}건, 연체 ${overdueCount}건${scheduledCount > 0 ? `, 예정 ${scheduledCount}건` : ''}`}
    >
      {/* Completed on time */}
      {completedCount > 0 && (
        <div
          className={`
            flex items-center gap-0.5 ${effectiveStyles.badge}
            bg-green-100 text-green-700 rounded-l-full
            ${overdueCount === 0 && scheduledCount === 0 ? 'rounded-r-full' : ''}
            font-medium border border-r-0 border-green-200
          `}
          title="정시 완료"
        >
          <Check className={effectiveStyles.icon} aria-hidden="true" />
          <span className={effectiveStyles.font}>{completedCount}</span>
          {showLabels && !isMobile && (
            <span className={`ml-0.5 ${effectiveStyles.font}`}>완료</span>
          )}
        </div>
      )}

      {/* Divider */}
      {completedCount > 0 && (overdueCount > 0 || scheduledCount > 0) && (
        <div className="w-px h-4 bg-gray-300" aria-hidden="true" />
      )}

      {/* Overdue */}
      {overdueCount > 0 && (
        <div
          className={`
            flex items-center gap-0.5 ${effectiveStyles.badge}
            bg-amber-100 text-amber-700
            ${completedCount === 0 ? 'rounded-l-full' : ''}
            ${scheduledCount === 0 ? 'rounded-r-full' : ''}
            font-medium border border-amber-200
            ${completedCount > 0 ? 'border-l-0' : ''}
            ${scheduledCount > 0 ? 'border-r-0' : ''}
          `}
          title="연체"
        >
          <AlertCircle className={effectiveStyles.icon} aria-hidden="true" />
          <span className={effectiveStyles.font}>{overdueCount}</span>
          {showLabels && !isMobile && (
            <span className={`ml-0.5 ${effectiveStyles.font}`}>연체</span>
          )}
        </div>
      )}

      {/* Scheduled (optional) */}
      {scheduledCount > 0 && (
        <>
          {(completedCount > 0 || overdueCount > 0) && (
            <div className="w-px h-4 bg-gray-300" aria-hidden="true" />
          )}
          <div
            className={`
              flex items-center gap-0.5 ${effectiveStyles.badge}
              bg-blue-100 text-blue-700 rounded-r-full
              ${completedCount === 0 && overdueCount === 0 ? 'rounded-l-full' : ''}
              font-medium border border-blue-200
              ${(completedCount > 0 || overdueCount > 0) ? 'border-l-0' : ''}
            `}
            title="예정"
          >
            <Calendar className={effectiveStyles.icon} aria-hidden="true" />
            <span className={effectiveStyles.font}>{scheduledCount}</span>
            {showLabels && !isMobile && (
              <span className={`ml-0.5 ${effectiveStyles.font}`}>예정</span>
            )}
          </div>
        </>
      )}

      {/* Total count (optional, shown separately) */}
      {totalCount !== undefined && totalCount > 0 && (
        <div className={`ml-1 ${effectiveStyles.font} text-gray-500`}>
          (총 {totalCount})
        </div>
      )}
    </div>
  );
}

// Alternative vertical layout for very constrained spaces
export function ScheduleIndicatorVertical({
  completedCount,
  overdueCount,
  scheduledCount = 0,
  className = ''
}: Omit<ScheduleIndicatorProps, 'size' | 'showLabels'>) {
  // Don't show anything if all counts are 0
  if (completedCount === 0 && overdueCount === 0 && scheduledCount === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-0.5 ${className}`}
      role="group"
      aria-label={`정시 완료 ${completedCount}건, 연체 ${overdueCount}건${scheduledCount > 0 ? `, 예정 ${scheduledCount}건` : ''}`}
    >
      {completedCount > 0 && (
        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
          <Check className="h-2.5 w-2.5" aria-hidden="true" />
          <span>{completedCount}</span>
        </div>
      )}
      {overdueCount > 0 && (
        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
          <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />
          <span>{overdueCount}</span>
        </div>
      )}
      {scheduledCount > 0 && (
        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
          <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
          <span>{scheduledCount}</span>
        </div>
      )}
    </div>
  );
}