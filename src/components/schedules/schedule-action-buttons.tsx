'use client'

import { Check, Pause, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useIsMobile } from "@/hooks/useIsMobile"
import { touchTarget } from "@/lib/utils"
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status"
import type { ScheduleWithDetails } from "@/types/schedule"

interface ScheduleActionButtonsProps {
  schedule: ScheduleWithDetails
  variant?: 'default' | 'compact'
  showStatus?: boolean
  onComplete?: () => void
  onPause?: () => void
  onResume?: () => void
  onDelete?: () => void
  className?: string
}

export function ScheduleActionButtons({
  schedule,
  variant = 'default',
  showStatus = true,
  onComplete,
  onPause,
  onResume,
  onDelete,
  className = ''
}: ScheduleActionButtonsProps) {
  const isMobile = useIsMobile()
  const statusInfo = getScheduleStatusLabel(schedule)
  const buttonSize = variant === 'compact' ? 'sm' : (isMobile ? 'default' : 'sm')
  
  return (
    <div className={`flex items-center ${isMobile && variant === 'default' ? 'w-full' : 'gap-2'} ${className}`}>
      {/* 완료 처리 버튼 - 활성 상태일 때만 표시 */}
      {schedule.status === 'active' && onComplete && (
        <Button
          size={buttonSize}
          variant="outline"
          onClick={onComplete}
          aria-label="스케줄 완료 처리"
          className={`flex items-center gap-2 ${isMobile && variant === 'default' ? 'flex-1 justify-center' : ''} ${touchTarget.button}`}
        >
          <Check className="h-4 w-4" />
          {variant === 'default' && '완료 처리'}
        </Button>
      )}
      
      {/* 일시중지/재개 버튼 */}
      {schedule.status === 'active' && onPause && (
        <Button
          size={buttonSize}
          variant="outline"
          onClick={onPause}
          aria-label="스케줄 일시중지"
          className={`${variant === 'compact' ? '' : 'flex items-center gap-2'} ${touchTarget.button}`}
        >
          <Pause className="h-4 w-4" />
          {variant === 'default' && '일시중지'}
        </Button>
      )}
      
      {schedule.status === 'paused' && onResume && (
        <Button
          size={buttonSize}
          variant="outline"
          onClick={onResume}
          aria-label="스케줄 재개"
          className={`${variant === 'compact' ? '' : 'flex items-center gap-2'} ${touchTarget.button}`}
        >
          <Play className="h-4 w-4" />
          {variant === 'default' && '재개'}
        </Button>
      )}
      
      {/* 삭제 버튼 */}
      {onDelete && (
        <Button
          size={buttonSize}
          variant="destructive"
          onClick={onDelete}
          className={touchTarget.iconButton}
          aria-label="스케줄 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      
      {/* 상태 배지 */}
      {showStatus && !isMobile && (
        <Badge className={getStatusBadgeClass(statusInfo.variant)}>
          {statusInfo.label}
        </Badge>
      )}
    </div>
  )
}