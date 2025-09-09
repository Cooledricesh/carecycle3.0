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
import type { ScheduleWithDetails } from "@/types/schedule"

interface ScheduleCompletionDialogProps {
  schedule: ScheduleWithDetails | null
  isOpen: boolean
  onClose: () => void
  executionDate: string
  executionNotes: string
  isSubmitting: boolean
  onExecutionDateChange: (date: string) => void
  onExecutionNotesChange: (notes: string) => void
  onSubmit: () => Promise<void>
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className={isMobile ? "max-w-[calc(100vw-2rem)] mx-4" : "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle className={responsiveText.h3}>일정 완료 처리</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {schedule && (
              <>
                <strong>{schedule.patient?.name}</strong>님의{' '}
                <strong>{schedule.item?.name}</strong> 일정을 완료 처리합니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            />
          </div>
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
            />
          </div>
          {schedule && schedule.intervalWeeks && (
            <div className="text-xs sm:text-sm text-gray-600">
              <p>다음 예정일: {
                (() => {
                  const nextDate = addWeeks(executionDate, schedule.intervalWeeks);
                  return nextDate ? safeFormatDate(nextDate, 'yyyy년 MM월 dd일') : '계산 오류';
                })()
              } ({schedule.intervalWeeks}주 후, 자동 계산됨)</p>
            </div>
          )}
        </div>
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
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
          >
            {isSubmitting ? '처리 중...' : '완료 처리'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}