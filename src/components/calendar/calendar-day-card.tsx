'use client'

import { useState, useEffect, useRef } from "react"
import { Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ScheduleActionButtons } from "@/components/schedules/schedule-action-buttons"
import { ScheduleEditModal } from "@/components/schedules/schedule-edit-modal"
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status"
import type { ScheduleWithDetails } from "@/types/schedule"

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
  
  useEffect(() => {
    if (editModalOpen && triggerRef.current) {
      triggerRef.current.click()
      setEditModalOpen(false)
    }
  }, [editModalOpen])
  
  return (
    <div 
      className={`
        ${isMobile ? 'p-3' : 'p-4'} border rounded-lg transition-all hover:shadow-sm
        ${isOverdue ? 'border-red-200 bg-red-50/30' : 
          isToday ? 'border-orange-200 bg-orange-50/30' : 
          'border-gray-200 hover:border-gray-300'}
      `}
    >
      <div className={`flex flex-col gap-3`}>
        {/* 헤더 섹션 */}
        <div className="flex items-start justify-between">
          <div className={`space-y-1 flex-1`}>
            {/* 환자명과 상태 배지 */}
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : ''}`}>
                {schedule.patient?.name}
              </h4>
              <Badge className={`text-xs ${getStatusBadgeClass(statusInfo.variant)}`}>
                {statusInfo.variant === 'overdue' && (
                  <AlertCircle className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                )}
                {statusInfo.label}
              </Badge>
            </div>
            
            {/* 검사/주사 정보 */}
            <div className={`flex items-center gap-2 text-gray-600 ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}>
              <span className="font-medium">{schedule.item?.name}</span>
              {schedule.item?.category && (
                <>
                  <span>•</span>
                  <span>{schedule.item.category}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* 세부 정보 */}
        <div className={`grid gap-2 ${
          isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 md:grid-cols-2 gap-3 text-sm'
        }`}>
          {schedule.intervalWeeks && (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              <span>주기: {schedule.intervalWeeks}주마다</span>
            </div>
          )}
          {schedule.assignedNurse && (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="font-medium">담당:</span>
              <span>{schedule.assignedNurse.name}</span>
            </div>
          )}
        </div>
        
        {/* 메모 */}
        {schedule.notes && (
          <div className={`${isMobile ? 'p-2' : 'p-3'} bg-gray-50 rounded text-gray-600 ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>
            <span className="font-medium text-gray-700">메모:</span> {schedule.notes}
          </div>
        )}
        
        {/* 액션 버튼들 */}
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
      </div>
    </div>
  )
}