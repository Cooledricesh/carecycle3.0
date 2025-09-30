'use client'

import { Check, Pause, Play, Trash2, Edit, LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useIsMobile } from "@/hooks/useIsMobile"
import { touchTarget } from "@/lib/utils"
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status"
import type { ScheduleWithDetails } from "@/types/schedule"

// 버튼 설정을 위한 타입 정의
interface ButtonConfig {
  icon: LucideIcon
  label: string
  ariaLabel: string
  variant?: 'default' | 'outline' | 'destructive'
  className?: string
}

// 버튼 설정 객체 - 중앙 집중식 관리
const BUTTON_CONFIGS: Record<string, ButtonConfig> = {
  complete: {
    icon: Check,
    label: '확인',
    ariaLabel: '스케줄을 완료 상태로 변경',
    variant: 'outline'
  },
  pause: {
    icon: Pause,
    label: '보류',
    ariaLabel: '스케줄을 보류 상태로 변경',
    variant: 'outline'
  },
  resume: {
    icon: Play,
    label: '재개',
    ariaLabel: '보류 상태의 스케줄을 활성 상태로 재개',
    variant: 'outline'
  },
  edit: {
    icon: Edit,
    label: '수정',
    ariaLabel: '스케줄 정보 수정',
    variant: 'outline'
  },
  delete: {
    icon: Trash2,
    label: '삭제',
    ariaLabel: '스케줄을 영구적으로 삭제',
    variant: 'destructive'
  }
}

interface ScheduleActionButtonsProps {
  schedule: ScheduleWithDetails
  variant?: 'default' | 'compact'
  showStatus?: boolean
  showButtonLabels?: boolean  // 명시적인 라벨 표시 옵션
  onComplete?: () => void
  onPause?: () => void
  onResume?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

/**
 * Renders action buttons for schedule management based on status and variant.
 * Provides consistent UI with improved accessibility and responsive design.
 */
export function ScheduleActionButtons({
  schedule,
  variant = 'default',
  showStatus = true,
  showButtonLabels,
  onComplete,
  onPause,
  onResume,
  onEdit,
  onDelete,
  className = ''
}: ScheduleActionButtonsProps) {
  const isMobile = useIsMobile()
  const statusInfo = getScheduleStatusLabel(schedule)
  const buttonSize = variant === 'compact' ? 'sm' : (isMobile ? 'default' : 'sm')

  // 헬퍼 함수: 버튼 렌더링을 위한 공통 로직
  const renderActionButton = (
    configKey: string,
    onClick: () => void,
    additionalCondition: boolean = true
  ) => {
    const config = BUTTON_CONFIGS[configKey]
    const Icon = config.icon
    // showButtonLabels prop이 제공되면 우선 사용, 아니면 variant에 따라 결정
    const showLabel = showButtonLabels !== undefined ? showButtonLabels : variant === 'default'

    // 버튼 클래스 계산
    const buttonClassName = [
      'flex items-center gap-2',
      isMobile && variant === 'default' && configKey === 'complete' ? 'flex-1 justify-center' : '',
      showLabel ? touchTarget.button : touchTarget.iconButton,
      config.className || ''
    ].filter(Boolean).join(' ')

    if (!additionalCondition) return null

    return (
      <Button
        type="button"
        size={buttonSize}
        variant={config.variant || 'outline'}
        onClick={onClick}
        aria-label={config.ariaLabel}
        className={buttonClassName}
        data-show-label={showLabel}
        data-button-type={configKey}
      >
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {showLabel && (
          <span className="font-medium whitespace-nowrap">{config.label}</span>
        )}
      </Button>
    )
  }

  return (
    <div
      className={`flex items-center ${isMobile && variant === 'default' ? 'w-full' : 'gap-2'} ${className}`}
      role="group"
      aria-label="스케줄 액션 버튼 그룹"
    >
      {/* 완료 처리 버튼 - 활성 상태일 때만 표시 */}
      {schedule.status === 'active' && onComplete &&
        renderActionButton('complete', onComplete)}

      {/* 일시중지 버튼 - 활성 상태일 때만 표시 */}
      {schedule.status === 'active' && onPause &&
        renderActionButton('pause', onPause)}

      {/* 재개 버튼 - 일시중지 상태일 때만 표시 */}
      {schedule.status === 'paused' && onResume &&
        renderActionButton('resume', onResume)}

      {/* 수정 버튼 - 항상 표시 가능 */}
      {onEdit && renderActionButton('edit', onEdit)}

      {/* 삭제 버튼 - 항상 표시 가능 */}
      {onDelete && renderActionButton('delete', onDelete)}

      {/* 상태 배지 - 데스크톱에서만 표시 */}
      {showStatus && !isMobile && (
        <Badge
          className={getStatusBadgeClass(statusInfo.variant)}
          aria-label={`현재 상태: ${statusInfo.label}`}
        >
          {statusInfo.label}
        </Badge>
      )}
    </div>
  )
}