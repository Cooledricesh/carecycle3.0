'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Clock } from 'lucide-react'
import { format } from 'date-fns'

interface JoinRequest {
  id: string
  organization_id: string
  email: string
  name: string
  role: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export function JoinRequestsList() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Approval state
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null)
  const [approvalRole, setApprovalRole] = useState<string>('nurse')
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  // Rejection state
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  useEffect(() => {
    fetchJoinRequests()
  }, [])

  const fetchJoinRequests = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/join-requests')

      if (!response.ok) {
        throw new Error('가입 요청 목록을 불러오는데 실패했습니다')
      }

      const data = await response.json()
      setRequests(data.requests || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 요청 목록을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveClick = (request: JoinRequest) => {
    setSelectedRequest(request)
    setApprovalRole(request.role)
    setShowApprovalDialog(true)
  }

  const handleApprove = async () => {
    if (!selectedRequest) return

    setIsApproving(true)

    try {
      const response = await fetch(`/api/admin/join-requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: approvalRole,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '승인에 실패했습니다')
      }

      // Refresh the list
      await fetchJoinRequests()
      setShowApprovalDialog(false)
      setSelectedRequest(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인에 실패했습니다')
    } finally {
      setIsApproving(false)
    }
  }

  const handleRejectClick = (request: JoinRequest) => {
    setSelectedRequest(request)
    setRejectionReason('')
    setShowRejectionDialog(true)
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    setIsRejecting(true)

    try {
      const response = await fetch(`/api/admin/join-requests/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectionReason.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '거부에 실패했습니다')
      }

      // Refresh the list
      await fetchJoinRequests()
      setShowRejectionDialog(false)
      setSelectedRequest(null)
      setRejectionReason('')
    } catch (err) {
      alert(err instanceof Error ? err.message : '거부에 실패했습니다')
    } finally {
      setIsRejecting(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'nurse':
        return '스텝'
      case 'doctor':
        return '의사'
      case 'admin':
        return '관리자'
      default:
        return role
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            대기 중
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            <Check className="h-3 w-3" />
            승인됨
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            <X className="h-3 w-3" />
            거부됨
          </span>
        )
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchJoinRequests} variant="outline" className="mt-4">
          다시 시도
        </Button>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">가입 요청이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>직군</TableHead>
              <TableHead>요청일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.name}</TableCell>
                <TableCell>{request.email}</TableCell>
                <TableCell>{getRoleLabel(request.role)}</TableCell>
                <TableCell>
                  {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell className="text-right">
                  {request.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveClick(request)}
                        variant="default"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleRejectClick(request)}
                        variant="destructive"
                      >
                        <X className="h-4 w-4 mr-1" />
                        거부
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>가입 승인</DialogTitle>
            <DialogDescription>
              {selectedRequest?.name}님의 가입을 승인하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approval-role">직군</Label>
              <Select value={approvalRole} onValueChange={setApprovalRole}>
                <SelectTrigger id="approval-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nurse">스텝</SelectItem>
                  <SelectItem value="doctor">의사</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isApproving}
            >
              취소
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? '승인 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>가입 거부</DialogTitle>
            <DialogDescription>
              {selectedRequest?.name}님의 가입을 거부하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">거부 사유 (선택)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="거부 사유를 입력하세요..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectionDialog(false)}
              disabled={isRejecting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting}
            >
              {isRejecting ? '거부 중...' : '거부'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
