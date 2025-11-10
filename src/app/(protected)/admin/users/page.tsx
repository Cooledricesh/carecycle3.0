'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, X, UserCheck, UserX, Shield, User, Stethoscope, Edit2, Save, XCircle, Trash2, Mail, List } from 'lucide-react';
import { InviteUserModal } from '@/components/admin/InviteUserModal';
import { useDepartments, Department } from '@/hooks/useDepartments';
import Link from 'next/link';

type UserAction = {
  userId: string;
  action: 'approve' | 'reject' | 'activate' | 'deactivate' | 'delete';
  userName: string;
};

type ValidationResult = {
  valid: boolean;
  departmentId: string | null;
  error?: string;
};

// Helper: Get department name from department_id
function getDepartmentName(departmentId: string | null, departments: Department[]): string {
  if (!departmentId) return '-';
  const dept = departments.find(d => d.id === departmentId);
  return dept ? dept.name : '-';
}

// Utility: Validate role and department_id combinations
function validateRoleAndDepartment(role?: string, department_id?: string): ValidationResult {
  // Admin and doctor roles must have null department_id
  if (role === 'admin' || role === 'doctor') {
    return { valid: true, departmentId: null };
  }

  // Nurse role must have a valid department_id
  if (role === 'nurse') {
    if (!department_id || department_id === '_none') {
      return {
        valid: false,
        departmentId: null,
        error: '스텝(간호사)는 반드시 부서를 선택해야 합니다.'
      };
    }
    return { valid: true, departmentId: department_id };
  }

  // Other roles: department_id is optional
  const finalDepartmentId = department_id === '_none' || department_id === undefined ? null : department_id;
  return { valid: true, departmentId: finalDepartmentId };
}

// Utility: Check if current user has admin permissions
async function checkAdminPermission(supabase: any): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('인증되지 않은 사용자입니다.');
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    throw new Error('관리자만 사용자 정보를 수정할 수 있습니다.');
  }

  return user.id;
}

// Utility: Make API call to update user
async function updateUserByAdmin(payload: {
  userId: string;
  role?: string;
  department_id?: string | null;
}): Promise<void> {
  const response = await fetch('/api/admin/users/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('API error details:', result);
    throw new Error(result.error || 'Failed to update user');
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<UserAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role?: string; department_id?: string }>({});
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  // Fetch departments from database
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();

  // Available roles
  const roles = [
    { value: 'nurse', label: '스텝' },
    { value: 'doctor', label: '주치의' },
    { value: 'admin', label: '관리자' },
  ];

  const fetchUsers = useCallback(async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setCurrentUserId(authUser.id);
      }

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

  const handleEditStart = (userId: string, currentRole: string, currentDepartmentId: string | null) => {
    setEditingUser(userId);
    setEditForm({
      role: currentRole,
      department_id: currentDepartmentId || undefined,
    });
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleEditSave = async (userId: string, originalRole: string, originalDepartmentId: string | null) => {
    console.log('handleEditSave called:', { userId, originalRole, originalDepartmentId, editForm });

    // Step 1: Validate role and department_id combination
    const validation = validateRoleAndDepartment(editForm.role, editForm.department_id);
    if (!validation.valid) {
      toast({
        title: '오류',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    const newDepartmentId = validation.departmentId;

    // Check if any changes were made
    if (editForm.role === originalRole && newDepartmentId === originalDepartmentId) {
      handleEditCancel();
      return;
    }

    setSaving(true);
    try {
      // Step 2: Check admin permission
      const currentUserId = await checkAdminPermission(supabase);

      // Prevent changing own role
      if (userId === currentUserId && editForm.role !== originalRole) {
        throw new Error('자신의 역할은 변경할 수 없습니다.');
      }

      // Step 3: Build payload for API call
      const payload = {
        userId,
        role: editForm.role !== originalRole ? editForm.role : undefined,
        department_id: newDepartmentId !== originalDepartmentId ? newDepartmentId : undefined,
      };
      console.log('Sending API request with payload:', payload);

      // Step 4: Call helper to update user
      await updateUserByAdmin(payload);

      // Step 5: Handle successful result
      toast({
        title: '성공',
        description: '사용자 정보가 업데이트되었습니다.',
      });

      await fetchUsers();
      handleEditCancel();
    } catch (error: any) {
      console.error('Error updating user:', error);
      const errorMessage = error?.message || error?.error_description || error?.details ||
                          (typeof error === 'string' ? error : '사용자 정보 업데이트에 실패했습니다.');
      toast({
        title: '오류',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUserAction = async () => {
    if (!actionDialog) return;

    setProcessing(true);
    const { userId, action } = actionDialog;

    try {
      let error = null;

      switch (action) {
        case 'approve': {
          const approveArgs = {
            user_id: userId
          };
          const { error: approveError } = await (supabase as any).rpc('approve_user', approveArgs);
          error = approveError;
          break;
        }
        case 'reject': {
          const rejectArgs = {
            user_id: userId,
            reason: '관리자에 의해 거부됨'
          };
          const { error: rejectError } = await (supabase as any).rpc('reject_user', rejectArgs);
          error = rejectError;
          break;
        }
        case 'activate': {
          const activateArgs = {
            user_id: userId
          };
          const { error: activateError } = await (supabase as any).rpc('approve_user', activateArgs);
          error = activateError;
          break;
        }
        case 'deactivate': {
          const deactivateArgs = {
            user_id: userId,
            reason: '관리자에 의해 비활성화됨'
          };
          const { error: deactivateError } = await (supabase as any).rpc('deactivate_user', deactivateArgs);
          error = deactivateError;
          break;
        }
        case 'delete':
          const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to delete user');
          }
          break;
      }

      if (error) throw error;

      toast({
        title: '성공',
        description: `사용자 ${actionDialog.userName}님이 ${
          action === 'approve' ? '승인' :
          action === 'reject' ? '거부' :
          action === 'activate' ? '활성화' :
          action === 'deactivate' ? '비활성화' : '삭제'
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

  if (loading || departmentsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.approval_status === 'pending' || u.approval_status === null);
  const approvedUsers = users.filter(u => u.approval_status === 'approved');
  const rejectedUsers = users.filter(u => u.approval_status === 'rejected');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="text-gray-600">가입 신청을 관리하고 사용자 계정을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/invitations">
            <Button variant="outline" size="sm">
              <List className="w-4 h-4 mr-2" />
              초대 관리
            </Button>
          </Link>
          <Button onClick={() => setIsInviteModalOpen(true)} size="sm">
            <Mail className="w-4 h-4 mr-2" />
            사용자 초대
          </Button>
        </div>
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
                    <TableCell>{getDepartmentName(user.department_id, departments)}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
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
                <TableHead className="text-center">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isEditing = editingUser === user.id;
                const isCurrentUser = user.id === currentUserId; // Prevent editing current admin

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={editForm.department_id || '_none'}
                          onValueChange={(value) => setEditForm({ ...editForm, department_id: value === '_none' ? undefined : value })}
                          disabled={saving || editForm.role === 'admin' || editForm.role === 'doctor'}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="부서 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(editForm.role === 'admin' || editForm.role === 'doctor') ? (
                              <SelectItem value="_none">-</SelectItem>
                            ) : (
                              <>
                                <SelectItem value="_none" disabled={editForm.role === 'nurse'}>
                                  없음
                                </SelectItem>
                                {departments.map(dept => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        getDepartmentName(user.department_id, departments)
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing && !isCurrentUser ? (
                        <Select
                          value={editForm.role}
                          onValueChange={(value) => {
                            // Auto-adjust department_id based on new role
                            if (value === 'admin' || value === 'doctor') {
                              // Admins and doctors must have null department_id
                              setEditForm({ role: value, department_id: undefined });
                            } else if (value === 'nurse' && !editForm.department_id) {
                              // Nurses must have a department_id, default to first department
                              const firstDept = departments[0];
                              setEditForm({ role: value, department_id: firstDept?.id });
                            } else {
                              setEditForm({ ...editForm, role: value });
                            }
                          }}
                          disabled={saving}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getRoleBadge(user.role)
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(user.approval_status || 'pending')}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? "default" : "secondary"}
                        className={user.is_active ? "bg-green-100 text-green-800" : ""}
                      >
                        {user.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSave(user.id, user.role, user.department_id)}
                              disabled={saving}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleEditCancel}
                              disabled={saving}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {user.approval_status === 'approved' && !isCurrentUser && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditStart(user.id, user.role, user.department_id)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
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
                            {!isCurrentUser && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setActionDialog({
                                  userId: user.id,
                                  action: 'delete',
                                  userName: user.name
                                })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
              {actionDialog?.action === 'delete' && '사용자 삭제'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.userName}님을 {
                actionDialog?.action === 'approve' ? '승인하시겠습니까? 승인 후 해당 사용자는 시스템에 로그인할 수 있습니다.' :
                actionDialog?.action === 'reject' ? '거부하시겠습니까? 거부된 사용자는 시스템에 접근할 수 없습니다.' :
                actionDialog?.action === 'activate' ? '활성화하시겠습니까? 활성화된 사용자는 시스템에 로그인할 수 있습니다.' :
                actionDialog?.action === 'deactivate' ? '비활성화하시겠습니까? 비활성화된 사용자는 시스템에 접근할 수 없습니다.' :
                '완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 사용자의 모든 데이터가 삭제됩니다.'
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

      {/* Invite User Modal */}
      <InviteUserModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
      />
    </div>
  );
}
