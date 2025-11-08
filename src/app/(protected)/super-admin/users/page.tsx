'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Shield, User, Stethoscope, Search, UserX, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse';
  care_type: string | null;
  is_active: boolean;
  created_at: string;
  organization_id: string;
  organization_name?: string;
}

type UserAction = {
  userId: string;
  userName: string;
  action: 'activate' | 'deactivate';
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'doctor' | 'nurse'>('all');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [actionDialog, setActionDialog] = useState<UserAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all organizations first
      const orgsResponse = await fetch('/api/super-admin/organizations');
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        setOrganizations(orgsData.organizations || []);
      }

      // Fetch all users from all organizations
      const usersResponse = await fetch('/api/super-admin/organizations');
      if (!usersResponse.ok) {
        throw new Error('사용자 목록을 불러오는데 실패했습니다');
      }

      const orgsData = await usersResponse.json();

      // Flatten users from all organizations
      const allUsers: User[] = [];
      for (const org of orgsData.organizations || []) {
        const orgDetailResponse = await fetch(`/api/super-admin/organizations/${org.id}`);
        if (orgDetailResponse.ok) {
          const orgDetail = await orgDetailResponse.json();
          const usersWithOrg = (orgDetail.organization.users || []).map((user: User) => ({
            ...user,
            organization_id: org.id,
            organization_name: org.name,
          }));
          allUsers.push(...usersWithOrg);
        }
      }

      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '사용자 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'doctor' | 'nurse') => {
    setUpdating(userId);
    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '역할 변경에 실패했습니다');
      }

      toast({
        title: '성공',
        description: '사용자 역할이 변경되었습니다.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '역할 변경에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async () => {
    if (!actionDialog) return;

    const { userId, action } = actionDialog;
    setProcessing(true);

    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: action === 'deactivate' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'activate' ? JSON.stringify({ is_active: true }) : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `사용자 ${action === 'activate' ? '활성화' : '비활성화'}에 실패했습니다`);
      }

      toast({
        title: '성공',
        description: `사용자가 ${action === 'activate' ? '활성화' : '비활성화'}되었습니다.`,
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error toggling user:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '사용자 상태 변경에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setActionDialog(null);
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
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">사용자 목록 로딩 중...</p>
      </div>
    );
  }

  // Apply filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    const matchesOrg = organizationFilter === 'all' || user.organization_id === organizationFilter;

    return matchesSearch && matchesRole && matchesOrg;
  });

  const totalCount = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const doctorCount = users.filter(u => u.role === 'doctor').length;
  const nurseCount = users.filter(u => u.role === 'nurse').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
        <p className="text-gray-600">전체 시스템 사용자를 관리합니다.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 사용자</CardDescription>
            <CardTitle className="text-2xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>관리자</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{adminCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>주치의</CardDescription>
            <CardTitle className="text-2xl text-green-600">{doctorCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>스텝</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{nurseCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="이름 또는 이메일로 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="역할" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 역할</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="doctor">주치의</SelectItem>
                <SelectItem value="nurse">스텝</SelectItem>
              </SelectContent>
            </Select>
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="조직" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 조직</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>
            {filteredUsers.length}명의 사용자가 검색되었습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>조직</TableHead>
                <TableHead>부서</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.organization_name || '-'}</TableCell>
                    <TableCell>
                      {user.care_type === '입원' ? '병동' : (user.care_type || '-')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value as 'admin' | 'doctor' | 'nurse')}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue>
                            {getRoleBadge(user.role)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              관리자
                            </div>
                          </SelectItem>
                          <SelectItem value="doctor">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="w-4 h-4" />
                              주치의
                            </div>
                          </SelectItem>
                          <SelectItem value="nurse">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              스텝
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? 'default' : 'secondary'}
                        className={user.is_active ? 'bg-green-100 text-green-800' : ''}
                      >
                        {user.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setActionDialog({
                            userId: user.id,
                            userName: user.name,
                            action: user.is_active ? 'deactivate' : 'activate',
                          })
                        }
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activate/Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!actionDialog}
        onOpenChange={() => setActionDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.action === 'activate' ? '사용자 활성화' : '사용자 비활성화'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.userName}님을{' '}
              {actionDialog?.action === 'activate' ? '활성화' : '비활성화'}하시겠습니까?
              {actionDialog?.action === 'deactivate' &&
                ' 비활성화된 사용자는 시스템에 접근할 수 없습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={processing}>
              {processing ? '처리 중...' : '확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
