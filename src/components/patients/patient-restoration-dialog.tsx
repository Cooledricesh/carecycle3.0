'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Calendar, 
  User,
  Hash
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { InactivePatient } from '@/lib/patient-management/patient-restore-manager'
import type { ConflictDetails } from '@/lib/patient-management/patient-validation-service'

export interface PatientRestorationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictDetails: ConflictDetails
  inactivePatient: InactivePatient | null
  isRestoring: boolean
  isCreatingWithArchive: boolean
  onRestore: () => void
  onCreateNew: () => void
  onCancel: () => void
}

export function PatientRestorationDialog({
  open,
  onOpenChange,
  conflictDetails,
  inactivePatient,
  isRestoring,
  isCreatingWithArchive,
  onRestore,
  onCreateNew,
  onCancel
}: PatientRestorationDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'restore' | 'create' | null>(null)

  const handleRestore = () => {
    setSelectedAction('restore')
    onRestore()
  }

  const handleCreateNew = () => {
    setSelectedAction('create')
    onCreateNew()
  }

  const handleCancel = () => {
    setSelectedAction(null)
    onCancel()
  }

  const isLoading = isRestoring || isCreatingWithArchive

  const getConflictIcon = () => {
    switch (conflictDetails.type) {
      case 'inactive_patient_exists':
        return <RefreshCw className="h-5 w-5 text-orange-500" />
      case 'archived_patient_exists':
        return <RefreshCw className="h-5 w-5 text-blue-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getConflictBadge = () => {
    const badgeClass = "px-2 py-1 text-xs rounded-md border"
    switch (conflictDetails.type) {
      case 'inactive_patient_exists':
        return <span className={`${badgeClass} text-orange-600 border-orange-300 bg-orange-50`}>삭제된 환자</span>
      case 'archived_patient_exists':
        return <span className={`${badgeClass} text-blue-600 border-blue-300 bg-blue-50`}>아카이빙된 환자</span>
      default:
        return <span className={`${badgeClass} text-yellow-600 border-yellow-300 bg-yellow-50`}>중복 환자번호</span>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getConflictIcon()}
            <div>
              <DialogTitle>환자번호 중복 감지</DialogTitle>
              <DialogDescription>
                동일한 환자번호의 환자가 이미 존재합니다
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflict Summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">중복된 환자번호</span>
              </div>
              {getConflictBadge()}
            </div>
            
            {inactivePatient && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{inactivePatient.name}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span>{inactivePatient.patientNumber}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {inactivePatient.archived && inactivePatient.archivedAt
                      ? `${format(new Date(inactivePatient.archivedAt), 'PPP', { locale: ko })} 아카이빙됨`
                      : `${format(new Date(inactivePatient.createdAt), 'PPP', { locale: ko })} 생성됨`
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Options */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">어떻게 처리하시겠습니까?</h4>
            
            {conflictDetails.canRestore && (
              <div 
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedAction === 'restore' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedAction('restore')}
              >
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">기존 환자 복원</div>
                    <div className="text-sm text-muted-foreground">
                      {inactivePatient?.archived 
                        ? '아카이빙된 환자를 다시 활성화합니다. 기존 데이터가 그대로 복원됩니다.'
                        : '삭제된 환자를 다시 활성화합니다. 기존 데이터가 그대로 복원됩니다.'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            {conflictDetails.canCreateNew && (
              <div 
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedAction === 'create' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedAction('create')}
              >
                <div className="flex items-start gap-3">
                  <Plus className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">새 환자로 등록</div>
                    <div className="text-sm text-muted-foreground">
                      기존 환자는 아카이빙하고 동일한 환자번호로 새 환자를 등록합니다.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warning Message */}
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">주의사항</div>
                <div className="text-xs space-y-1">
                  {selectedAction === 'restore' ? (
                    <div>기존 환자의 모든 데이터와 스케줄이 복원됩니다.</div>
                  ) : selectedAction === 'create' ? (
                    <div>기존 환자는 아카이빙되어 더 이상 접근할 수 없게 됩니다.</div>
                  ) : (
                    <div>작업을 진행하기 전에 처리 방법을 선택해주세요.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            취소
          </Button>
          
          {selectedAction === 'restore' && conflictDetails.canRestore && (
            <Button
              onClick={handleRestore}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  복원 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  환자 복원
                </>
              )}
            </Button>
          )}
          
          {selectedAction === 'create' && conflictDetails.canCreateNew && (
            <Button
              onClick={handleCreateNew}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreatingWithArchive ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  새로 등록
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}