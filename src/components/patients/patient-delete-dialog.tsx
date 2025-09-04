'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

interface PatientDeleteDialogProps {
  patientName: string
  patientNumber: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function PatientDeleteDialog({
  patientName,
  patientNumber,
  onConfirm,
  isDeleting = false
}: PatientDeleteDialogProps) {
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    onConfirm()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          aria-label="환자 삭제"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>환자를 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <span className="block">
                다음 환자를 삭제하려고 합니다:
              </span>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="font-medium">환자번호: {patientNumber}</div>
                <div className="font-medium">환자명: {patientName}</div>
              </div>
              <span className="block text-destructive font-medium">
                이 작업은 되돌릴 수 없습니다. 환자와 연관된 모든 스케줄 정보도 함께 비활성화됩니다.
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}