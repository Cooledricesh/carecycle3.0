'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"
import { responsiveText, touchTarget } from "@/lib/utils"
import { safeFormatDate, addWeeks } from "@/lib/utils/date"
import { format } from "date-fns"
import type { ScheduleWithDetails } from "@/types/schedule"
import { InjectionMetadataForm, type InjectionMetadata } from "./InjectionMetadataForm"
import { Separator } from "@/components/ui/separator"

interface ScheduleCompletionDialogProps {
  schedule: ScheduleWithDetails | null
  isOpen: boolean
  onClose: () => void
  executionDate: string
  executionNotes: string
  isSubmitting: boolean
  onExecutionDateChange: (date: string) => void
  onExecutionNotesChange: (notes: string) => void
  onSubmit: (metadata?: InjectionMetadata) => Promise<void>
}

export function ScheduleCompletionDialog({
  schedule,
  isOpen,
  onClose,
  executionDate,
  executionNotes,
  isSubmitting,
  onExecutionDateChange,
  onExecutionNotesChange,
  onSubmit
}: ScheduleCompletionDialogProps) {
  const isMobile = useIsMobile()
  const isInjectionCategory = schedule?.item_category === 'injection'

  const handleMetadataSubmit = (metadata: InjectionMetadata) => {
    onSubmit(metadata)
  }

  const handleNonInjectionSubmit = () => {
    onSubmit()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className={isMobile ? "max-w-[calc(100vw-2rem)] mx-4" : "sm:max-w-[525px]"}>
        <DialogHeader>
          <DialogTitle className={responsiveText.h3}>일정 완료 처리</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {schedule && (
              <>
                <strong>{schedule.patient_name}</strong>님의{' '}
                <strong>{schedule.item_name}</strong> 일정을 완료 처리합니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Execution Date */}
          <div className={`${isMobile ? 'grid gap-2' : 'grid grid-cols-4 items-center gap-4'}`}>
            <Label htmlFor="execution-date" className={isMobile ? '' : 'text-right'}>
              시행일
            </Label>
            <Input
              id="execution-date"
              type="date"
              value={executionDate}
              onChange={(e) => onExecutionDateChange(e.target.value)}
              className={`${isMobile ? 'w-full' : 'col-span-3'} ${touchTarget.input}`}
              disabled={isSubmitting}
            />
          </div>

          {/* Execution Notes - Only for non-injection categories */}
          {!isInjectionCategory && (
            <div className={`${isMobile ? 'grid gap-2' : 'grid grid-cols-4 items-center gap-4'}`}>
              <Label htmlFor="execution-notes" className={isMobile ? '' : 'text-right'}>
                메모
              </Label>
              <Textarea
                id="execution-notes"
                value={executionNotes}
                onChange={(e) => onExecutionNotesChange(e.target.value)}
                placeholder="시행 관련 메모를 입력하세요 (선택사항)"
                className={`${isMobile ? 'w-full' : 'col-span-3'}`}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Next Due Date Info */}
          {schedule && schedule.interval_weeks && (
            <div className="text-xs sm:text-sm text-gray-600">
              <p>다음 예정일: {
                (() => {
                  const nextDate = addWeeks(new Date(executionDate), schedule.interval_weeks);
                  return nextDate ? format(nextDate, 'yyyy년 MM월 dd일') : '계산 오류';
                })()
              } ({schedule.interval_weeks}주 후, 자동 계산됨)</p>
            </div>
          )}

          {/* Injection Metadata Form - Conditional */}
          {isInjectionCategory && (
            <>
              <Separator className="my-2" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">주사 정보</h4>
                <p className="text-xs text-gray-500">
                  주사 투여에 대한 세부 정보를 입력하세요
                </p>
              </div>
              <InjectionMetadataForm
                onSubmit={handleMetadataSubmit}
                onCancel={onClose}
                isSubmitting={isSubmitting}
              />
            </>
          )}
        </div>

        {/* Show footer buttons only for non-injection categories */}
        {!isInjectionCategory && (
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleNonInjectionSubmit}
              disabled={isSubmitting}
              className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
            >
              {isSubmitting ? '처리 중...' : '완료 처리'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}