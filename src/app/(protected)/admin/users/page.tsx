'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/database.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
import { Check, X, UserCheck, UserX, Shield, User, Stethoscope } from 'lucide-react';

type UserAction = {
  userId: string;
  action: 'approve' | 'reject' | 'activate' | 'deactivate';
  userName: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<UserAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: '오류',
        description: '사용자 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserAction = async () => {
    if (!actionDialog) return;
    
    setProcessing(true);
    const { userId, action } = actionDialog;

    try {
      let error = null;
      
      switch (action) {
        case 'approve':
          const { error: approveError } = await supabase.rpc('approve_user', {
            user_id: userId
          });
          error = approveError;
          break;
        case 'reject':
          const { error: rejectError } = await supabase.rpc('reject_user', {
            user_id: userId,
            reason: '관리자에 의해 거부됨'
          });
          error = rejectError;
          break;
        case 'activate':
          const { error: activateError } = await supabase.rpc('approve_user', {
            user_id: userId
          });
          error = activateError;
          break;
        case 'deactivate':
          const { error: deactivateError } = await supabase.rpc('deactivate_user', {
            user_id: userId,
            reason: '관리자에 의해 비활성화됨'
          });
          error = deactivateError;
          break;
      }

      if (error) throw error;

      toast({
        title: '성공',
        description: `사용자 ${actionDialog.userName}님이 ${
          action === 'approve' ? '승인' : 
          action === 'reject' ? '거부' :
          action === 'activate' ? '활성화' : '비활성화'
        }되었습니다.`,
      });

      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: '오류',
        description: error?.message || '사용자 상태 업데이트에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setActionDialog(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">승인됨</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">대기중</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">거부됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-purple-100 text-purple-800">
            <Shield className="w-3 h-3 mr-1" />
            관리자
          </Badge>
        );
      case 'nurse':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <User className="w-3 h-3 mr-1" />
            스텝
          </Badge>
        );
      case 'doctor':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Stethoscope className="w-3 h-3 mr-1" />
            주치의
          </Badge>
        );
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.approval_status === 'pending');
  const approvedUsers = users.filter(u => u.approval_status === 'approved');
  const rejectedUsers = users.filter(u => u.approval_status === 'rejected');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
        <p className="text-gray-600">가입 신청을 관리하고 사용자 계정을 관리합니다.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 사용자</CardDescription>
            <CardTitle className="text-2xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인 대기</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{pendingUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인됨</CardDescription>
            <CardTitle className="text-2xl text-green-600">{approvedUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>거부됨</CardDescription>
            <CardTitle className="text-2xl text-red-600">{rejectedUsers.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>승인 대기 중인 사용자</CardTitle>
            <CardDescription>새로 가입 신청한 사용자를 검토하고 승인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.care_type || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => setActionDialog({
                          userId: user.id,
                          action: 'approve',
                          userName: user.name
                        })}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setActionDialog({
                          userId: user.id,
                          action: 'reject',
                          userName: user.name
                        })}
                      >
                        <X className="w-4 h-4 mr-1" />
                        거부
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>전체 사용자</CardTitle>
          <CardDescription>시스템에 등록된 모든 사용자를 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>부서</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>활성화</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.care_type || '-'}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.is_active ? "default" : "secondary"}
                      className={user.is_active ? "bg-green-100 text-green-800" : ""}
                    >
                      {user.is_active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.approval_status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActionDialog({
                          userId: user.id,
                          action: user.is_active ? 'deactivate' : 'activate',
                          userName: user.name
                        })}
                      >
                        {user.is_active ? (
                          <>
                            <UserX className="w-4 h-4 mr-1" />
                            비활성화
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            활성화
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.action === 'approve' && '사용자 승인'}
              {actionDialog?.action === 'reject' && '사용자 거부'}
              {actionDialog?.action === 'activate' && '사용자 활성화'}
              {actionDialog?.action === 'deactivate' && '사용자 비활성화'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.userName}님을 {
                actionDialog?.action === 'approve' ? '승인하시겠습니까? 승인 후 해당 사용자는 시스템에 로그인할 수 있습니다.' :
                actionDialog?.action === 'reject' ? '거부하시겠습니까? 거부된 사용자는 시스템에 접근할 수 없습니다.' :
                actionDialog?.action === 'activate' ? '활성화하시겠습니까? 활성화된 사용자는 시스템에 로그인할 수 있습니다.' :
                '비활성화하시겠습니까? 비활성화된 사용자는 시스템에 접근할 수 없습니다.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleUserAction} disabled={processing}>
              {processing ? '처리 중...' : '확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}