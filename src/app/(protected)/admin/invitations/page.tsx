'use client';

/**
 * Invitations Management Page
 *
 * List and manage organization invitations
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { InviteUserButton } from '@/components/admin/InviteUserButton';
import { InvitationStatusBadge } from '@/components/admin/InvitationStatusBadge';
import { calculateTimeUntilExpiry } from '@/lib/invitation-utils';
import { X, Copy, Check } from 'lucide-react';
import type { Invitation } from '@/lib/database.types';

export default function InvitationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch invitations
  const { data: invitations, isLoading } = useQuery({
    queryKey: ['invitations', statusFilter],
    queryFn: async () => {
      const url =
        statusFilter === 'all'
          ? '/api/admin/invitations'
          : `/api/admin/invitations?status=${statusFilter}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }

      return response.json() as Promise<Invitation[]>;
    },
  });

  // Delete invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '초대 삭제에 실패했습니다');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '초대 삭제 완료',
        description: '초대가 성공적으로 삭제되었습니다.',
      });

      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setCancelDialogOpen(false);
      setSelectedInvitation(null);
    },
    onError: (error: Error) => {
      toast({
        title: '초대 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCopyInvitationLink = async (invitation: Invitation) => {
    const invitationLink = `${window.location.origin}/auth/accept-invitation/${invitation.token}`;

    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopiedId(invitation.id);

      toast({
        title: '초대 링크 복사됨',
        description: '초대 링크가 클립보드에 복사되었습니다.',
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '링크를 복사하는데 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelClick = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (selectedInvitation) {
      cancelInvitationMutation.mutate(selectedInvitation.id);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>초대 관리</CardTitle>
              <CardDescription>조직의 사용자 초대를 관리합니다</CardDescription>
            </div>
            <InviteUserButton />
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 초대</SelectItem>
                <SelectItem value="pending">대기 중</SelectItem>
                <SelectItem value="accepted">수락됨</SelectItem>
                <SelectItem value="expired">만료됨</SelectItem>
                <SelectItem value="cancelled">취소됨</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">초대 목록 로딩 중...</div>
          ) : !invitations || invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              초대가 없습니다.{' '}
              {statusFilter !== 'all' ? '필터를 변경해보세요.' : '첫 초대를 보내보세요!'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>초대 링크</TableHead>
                    <TableHead>만료</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => {
                    const invitationLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/accept-invitation/${invitation.token}`;
                    const isCopied = copiedId === invitation.id;

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {invitation.role === 'admin' ? '관리자' :
                             invitation.role === 'doctor' ? '주치의' : '스텝'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <InvitationStatusBadge status={invitation.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                              {invitationLink}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyInvitationLink(invitation)}
                              className="h-7 px-2"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3 mr-1 text-green-600" />
                                  <span className="text-xs">복사됨</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  <span className="text-xs">복사</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{calculateTimeUntilExpiry(invitation.expires_at)}</TableCell>
                        <TableCell>
                          {new Date(invitation.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {invitation.status === 'pending' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelClick(invitation)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              삭제
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>초대 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{selectedInvitation?.email}</span>님에 대한 초대를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니오, 유지</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending ? '삭제 중...' : '네, 초대 삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
