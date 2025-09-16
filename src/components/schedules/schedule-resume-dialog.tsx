'use client'

import { useState } from 'react'
import { format, addWeeks, startOfDay, isBefore, isAfter } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, AlertCircle, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { Schedule } from '@/types/schedule'
import type { ResumeOptions } from '@/lib/schedule-management/schedule-state-manager'
import { cn } from '@/lib/utils'

interface ScheduleResumeDialogProps {
  schedule: Schedule
  missedExecutions: number
  pauseDuration: number // in weeks
  open: boolean
  onConfirm: (options: ResumeOptions) => void
  onCancel: () => void
}

export function ScheduleResumeDialog({
  schedule,
  missedExecutions,
  pauseDuration,
  open,
  onConfirm,
  onCancel,
}: ScheduleResumeDialogProps) {
  const [strategy, setStrategy] = useState<ResumeOptions['strategy']>('next_cycle')
  const [customDate, setCustomDate] = useState<Date | undefined>()
  const [handleMissed, setHandleMissed] = useState<ResumeOptions['handleMissed']>('skip')

  // Calculate preview dates based on strategy
  const getPreviewDate = () => {
    const today = new Date()
    switch (strategy) {
      case 'immediate':
        return today
      case 'next_cycle':
        return addWeeks(today, schedule.intervalWeeks || 1)
      case 'custom':
        return customDate || today
      default:
        return today
    }
  }

  const handleConfirm = () => {
    if (strategy === 'custom' && !customDate) {
      return // Don't proceed without custom date
    }

    const options: ResumeOptions = {
      strategy,
      customDate: strategy === 'custom' ? customDate : undefined,
      handleMissed,
    }

    onConfirm(options)
  }

  const previewDate = getPreviewDate()

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>스케줄 재개 옵션</DialogTitle>
          <DialogDescription>
            일시정지된 스케줄을 재개합니다. 재개 방법을 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pause Information */}
          <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">일시정지 기간</span>
                  <p className="font-medium">{pauseDuration}주</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">놓친 실행</span>
                  <p className="font-medium">{missedExecutions}회</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">주기</span>
                  <p className="font-medium">{schedule.intervalWeeks}주</p>
                </div>
              </div>
            </div>
          </div>

          {/* Resume Strategy Selection */}
          <div className="space-y-3">
            <Label>재개 전략</Label>
            <RadioGroup value={strategy} onValueChange={(value) => setStrategy(value as ResumeOptions['strategy'])}>
              <div className="space-y-3">
                <label htmlFor="resume-immediate" className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  strategy === 'immediate' && "border-primary bg-primary/5"
                )}>
                  <RadioGroupItem value="immediate" id="resume-immediate" className="mt-1" />
                  <div className="space-y-1">
                    <div className="font-medium">즉시 실행</div>
                    <div className="text-sm text-muted-foreground">
                      오늘 바로 실행하고, 이후 정상 주기로 진행합니다.
                    </div>
                    <Badge variant="outline" className="mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(), 'yyyy-MM-dd')}
                    </Badge>
                  </div>
                </label>

                <label htmlFor="resume-next-cycle" className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  strategy === 'next_cycle' && "border-primary bg-primary/5"
                )}>
                  <RadioGroupItem value="next_cycle" id="resume-next-cycle" className="mt-1" />
                  <div className="space-y-1">
                    <div className="font-medium">다음 주기부터</div>
                    <div className="text-sm text-muted-foreground">
                      오늘부터 {schedule.intervalWeeks}주 후에 시작합니다.
                    </div>
                    <Badge variant="outline" className="mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(addWeeks(new Date(), schedule.intervalWeeks || 1), 'yyyy-MM-dd')}
                    </Badge>
                  </div>
                </label>

                <label htmlFor="resume-custom" className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  strategy === 'custom' && "border-primary bg-primary/5"
                )}>
                  <RadioGroupItem value="custom" id="resume-custom" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="font-medium">날짜 지정</div>
                    <div className="text-sm text-muted-foreground">
                      원하는 날짜를 직접 선택합니다.
                    </div>
                    {strategy === 'custom' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !customDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {customDate ? (
                              format(customDate, 'PPP', { locale: ko })
                            ) : (
                              <span>날짜 선택...</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker
                            mode="single"
                            selected={customDate}
                            onSelect={setCustomDate}
                            disabled={(date) => {
                              const today = startOfDay(new Date())
                              const candidateDate = startOfDay(date)
                              // Disable past dates (before today)
                              if (isBefore(candidateDate, today)) return true
                              // If there's an end date, disable dates after it
                              if (schedule.endDate) {
                                const endDate = startOfDay(new Date(schedule.endDate))
                                if (isAfter(candidateDate, endDate)) return true
                              }
                              return false
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Missed Executions Handling */}
          {missedExecutions > 0 && (
            <div className="space-y-3">
              <Label>놓친 실행 처리</Label>
              <RadioGroup value={handleMissed} onValueChange={(value) => setHandleMissed(value as ResumeOptions['handleMissed'])}>
                <div className="space-y-2">
                  <label htmlFor="missed-skip" className="flex items-center gap-2">
                    <RadioGroupItem value="skip" id="missed-skip" />
                    <span>건너뛰기 (과거 실행 무시)</span>
                  </label>
                  <label htmlFor="missed-catch-up" className="flex items-center gap-2">
                    <RadioGroupItem value="catch_up" id="missed-catch-up" />
                    <span>따라잡기 (압축된 일정으로 실행)</span>
                  </label>
                  <label htmlFor="missed-mark-overdue" className="flex items-center gap-2">
                    <RadioGroupItem value="mark_overdue" id="missed-mark-overdue" />
                    <span>연체 표시 (검토 후 수동 처리)</span>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Preview */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>다음 예정일:</strong> {format(previewDate, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
              {handleMissed === 'catch_up' && missedExecutions > 0 && (
                <div className="mt-2 text-sm">
                  추가로 {missedExecutions}개의 따라잡기 실행이 생성됩니다.
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Warning for end date */}
          {schedule.endDate && isAfter(startOfDay(previewDate), startOfDay(new Date(schedule.endDate))) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                선택한 날짜가 스케줄 종료일을 초과합니다.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (strategy === 'custom' && !customDate) ||
              (schedule.endDate && isAfter(startOfDay(previewDate), startOfDay(new Date(schedule.endDate))))
            }
          >
            재개
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}