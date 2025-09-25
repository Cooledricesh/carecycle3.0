'use client'

import { useState, useEffect, useRef } from "react"
import { Clock, AlertCircle, Check } from "lucide-react"
import { getScheduleCategoryIcon, getScheduleCategoryColor, getScheduleCategoryBgColor, getScheduleCategoryLabel, getScheduleCardBgColor } from '@/lib/utils/schedule-category'
import { Badge } from "@/components/ui/badge"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ScheduleActionButtons } from "@/components/schedules/schedule-action-buttons"
import { ScheduleEditModal } from "@/components/schedules/schedule-edit-modal"
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status"
import type { ScheduleWithDetails } from "@/types/schedule"
import type { ItemCategory } from "@/lib/database.types"

interface CalendarDayCardProps {
  schedule: ScheduleWithDetails
  onComplete?: () => void
  onPause?: () => void
  onResume?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onRefresh?: () => void
}

export function CalendarDayCard({
  schedule,
  onComplete,
  onPause,
  onResume,
  onEdit,
  onDelete,
  onRefresh
}: CalendarDayCardProps) {
  const [editModalOpen, setEditModalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isMobile = useIsMobile()
  const statusInfo = getScheduleStatusLabel(schedule)
  const isOverdue = statusInfo.variant === 'overdue'
  const isToday = statusInfo.variant === 'today'
  const isCompleted = (schedule as any).display_type === 'completed'

  useEffect(() => {
    if (editModalOpen && triggerRef.current) {
      triggerRef.current.click()
      setEditModalOpen(false)
    }
  }, [editModalOpen])

  // Get the category from schedule and cast to ItemCategory
  const category = schedule.item_category as ItemCategory;

  return (
    <div
      className={`
        ${isMobile ? 'p-3' : 'p-4'} border rounded-lg transition-all hover:shadow-sm
        ${isCompleted ? 'bg-gray-50 opacity-75' : getScheduleCardBgColor(category)}
        ${isCompleted ? 'border-gray-300' :
          isOverdue ? 'border-red-200' :
          isToday ? 'border-orange-200' :
          'border-gray-200 hover:border-gray-300'}
      `}
    >
      <div className={`flex flex-col gap-3`}>
        {/* 헤더 섹션 */}
        <div className="flex items-start justify-between">
          <div className={`space-y-1 flex-1`}>
            {/* 환자명과 상태 배지 */}
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <h4 className={`font-semibold ${isCompleted ? 'text-gray-600 line-through' : 'text-gray-900'} ${isMobile ? 'text-sm' : ''}`}>
                {schedule.patient_name || '환자 정보 없음'}
              </h4>
              {isCompleted ? (
                <Badge className="text-xs bg-gray-200 text-gray-600">
                  <Check className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                  완료됨
                </Badge>
              ) : (
                <Badge className={`text-xs ${getStatusBadgeClass(statusInfo.variant)}`}>
                  {statusInfo.variant === 'overdue' && (
                    <AlertCircle className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                  )}
                  {statusInfo.label}
                </Badge>
              )}
            </div>

            {/* 검사/주사 정보 */}
            <div className={`flex items-center gap-2 text-gray-600 ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}>
              {(() => {
                const IconComponent = getScheduleCategoryIcon(category);
                return IconComponent ? (
                  <IconComponent className={`h-4 w-4 ${getScheduleCategoryColor(category)}`} />
                ) : null;
              })()}
              <span className="font-medium">{schedule.item_name || '항목 정보 없음'}</span>
              {category && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${getScheduleCategoryBgColor(category)} ${getScheduleCategoryColor(category)}`}>
                  {getScheduleCategoryLabel(category)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* 세부 정보 */}
        <div className={`grid gap-2 ${
          isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 md:grid-cols-2 gap-3 text-sm'
        }`}>
          {schedule.interval_weeks && (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              <span>주기: {schedule.interval_weeks}주마다</span>
            </div>
          )}
          {/* Note: assignedNurse data not available in current RPC response */}
        </div>
        
        {/* 메모 */}
        {schedule.notes && (
          <div className={`${isMobile ? 'p-2' : 'p-3'} bg-gray-50 rounded text-gray-600 ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>
            <span className="font-medium text-gray-700">메모:</span> {schedule.notes}
          </div>
        )}
        
        {/* 액션 버튼들 - 완료된 항목은 버튼 숨기기 */}
        {!isCompleted && (
          <div className="pt-2 border-t">
            <ScheduleActionButtons
              schedule={schedule}
              variant={isMobile ? 'default' : 'compact'}
              showStatus={false}
              onComplete={onComplete}
              onPause={onPause}
              onResume={onResume}
              onEdit={() => setEditModalOpen(true)}
              onDelete={onDelete}
            />
            <ScheduleEditModal
              schedule={schedule}
              onSuccess={onRefresh}
              triggerButton={
                <button
                  ref={triggerRef}
                  style={{ display: 'none' }}
                  aria-hidden="true"
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}