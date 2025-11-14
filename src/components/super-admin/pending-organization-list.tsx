'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useOrganizationRequests } from '@/hooks/useOrganizationRequests'
import { ApprovalStatusBadge } from '@/components/shared/approval-status-badge'
import { OrganizationApprovalDialog } from './organization-approval-dialog'
import { format } from 'date-fns'
import { Clock, Building2, User, Mail, Calendar } from 'lucide-react'

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

export function PendingOrganizationList() {
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null)

  // Always fetch all requests for accurate statistics
  const { data, isLoading } = useOrganizationRequests({
    status: null, // Fetch all statuses
  })

  const allRequests = data?.requests || []

  // Filter requests on client side
  const requests = filter === 'all'
    ? allRequests
    : allRequests.filter(r => r.status === filter)

  const handleApproveClick = (requestId: string) => {
    setSelectedRequest(requestId)
    setDialogAction('approve')
  }

  const handleRejectClick = (requestId: string) => {
    setSelectedRequest(requestId)
    setDialogAction('reject')
  }

  const handleDialogClose = () => {
    setSelectedRequest(null)
    setDialogAction(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2">로딩 중...</span>
      </div>
    )
  }

  // Calculate statistics from all requests (not filtered)
  const pendingCount = allRequests.filter(r => r.status === 'pending').length
  const approvedCount = allRequests.filter(r => r.status === 'approved').length
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 신청</CardDescription>
            <CardTitle className="text-2xl">{allRequests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인 대기</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인 완료</CardDescription>
            <CardTitle className="text-2xl text-green-600">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>거부</CardDescription>
            <CardTitle className="text-2xl text-red-600">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          전체 ({allRequests.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'pending'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          대기 중 ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'approved'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          승인됨 ({approvedCount})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'rejected'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          거부됨 ({rejectedCount})
        </button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>신규 기관 등록 신청</CardTitle>
          <CardDescription>
            {requests.length}건의 등록 신청
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>기관명</TableHead>
                <TableHead>신청자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>신청일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    등록 신청이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{request.organization_name}</span>
                      </div>
                      {request.organization_description && (
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                          {request.organization_description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{request.requester_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{request.requester_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {format(new Date(request.created_at), 'yyyy-MM-dd')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ApprovalStatusBadge status={request.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveClick(request.id)}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(request.id)}
                          >
                            거부
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline">처리 완료</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedRequest && dialogAction && (
        <OrganizationApprovalDialog
          requestId={selectedRequest}
          action={dialogAction}
          request={requests.find(r => r.id === selectedRequest)}
          onClose={handleDialogClose}
        />
      )}
    </div>
  )
}
