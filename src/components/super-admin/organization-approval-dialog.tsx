'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useApproveOrganization, useRejectOrganization } from '@/hooks/useApproveOrganization'
import { AlertCircle, Check, X } from 'lucide-react'
import type { OrganizationRequest } from '@/hooks/useOrganizationRequests'

interface OrganizationApprovalDialogProps {
  requestId: string
  action: 'approve' | 'reject'
  request?: OrganizationRequest
  onClose: () => void
}

export function OrganizationApprovalDialog({
  requestId,
  action,
  request,
  onClose,
}: OrganizationApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const approveMutation = useApproveOrganization()
  const rejectMutation = useRejectOrganization()

  const isProcessing = approveMutation.isPending || rejectMutation.isPending

  const handleApprove = async () => {
    try {
      setError(null)
      await approveMutation.mutateAsync({ requestId })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : '승인 처리 중 오류가 발생했습니다'
      setError(message)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('거부 사유를 입력해주세요')
      return
    }

    try {
      setError(null)
      await rejectMutation.mutateAsync({
        requestId,
        rejectionReason: rejectionReason.trim(),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : '거부 처리 중 오류가 발생했습니다'
      setError(message)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' ? (
              <>
                <Check className="w-5 h-5 text-green-600" />
                <span>기관 승인</span>
              </>
            ) : (
              <>
                <X className="w-5 h-5 text-red-600" />
                <span>기관 거부</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === 'approve'
              ? '이 기관 등록을 승인하시겠습니까?'
              : '이 기관 등록을 거부하시겠습니까?'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {request && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">신청 정보</h4>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">기관명:</span> {request.organization_name}</p>
              <p><span className="font-medium">신청자:</span> {request.requester_name}</p>
              <p><span className="font-medium">이메일:</span> {request.requester_email}</p>
              {request.organization_description && (
                <p>
                  <span className="font-medium">설명:</span> {request.organization_description}
                </p>
              )}
            </div>
          </div>
        )}

        {action === 'approve' && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <p className="text-sm font-semibold mb-1">승인 시 수행 작업:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>신규 기관 생성</li>
                <li>관리자 계정 생성 및 활성화</li>
                <li>승인 알림 이메일 발송</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {action === 'reject' && (
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">거부 사유 *</Label>
            <Textarea
              id="rejection-reason"
              placeholder="거부 사유를 입력하세요"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              입력하신 거부 사유는 신청자에게 이메일로 전달됩니다
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            취소
          </Button>
          {action === 'approve' ? (
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? '처리 중...' : '승인'}
            </Button>
          ) : (
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? '처리 중...' : '거부'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
