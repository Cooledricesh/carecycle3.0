'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
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
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, User, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse';
  care_type: string | null;
  is_active: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  users: User[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrganizationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/super-admin/organizations/${id}`);

      if (!response.ok) {
        throw new Error('조직 정보를 불러오는데 실패했습니다');
      }

      const data = await response.json();
      setOrganization(data.organization);
    } catch (error) {
      console.error('Error fetching organization:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '조직 정보를 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

      await fetchOrganization();
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
        <p className="text-muted-foreground">조직 정보 로딩 중...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>조직을 찾을 수 없습니다</CardTitle>
            <CardDescription>요청한 조직이 존재하지 않습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/super-admin/organizations')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              조직 목록으로
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const adminCount = organization.users.filter(u => u.role === 'admin').length;
  const doctorCount = organization.users.filter(u => u.role === 'doctor').length;
  const nurseCount = organization.users.filter(u => u.role === 'nurse').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/super-admin/organizations')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{organization.name}</CardTitle>
              <CardDescription>조직 ID: {organization.id}</CardDescription>
            </div>
            <Badge
              variant={organization.is_active ? 'default' : 'secondary'}
              className={organization.is_active ? 'bg-green-100 text-green-800' : ''}
            >
              {organization.is_active ? '활성' : '비활성'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">생성일</p>
              <p className="font-medium">
                {format(new Date(organization.created_at), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">전체 사용자</p>
              <p className="font-medium">{organization.users.length}명</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>조직에 속한 사용자를 관리합니다.</CardDescription>
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
                <TableHead>가입일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                organization.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
