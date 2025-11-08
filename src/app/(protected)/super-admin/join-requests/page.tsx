'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Clock, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface JoinRequest {
  id: string;
  organization_id: string;
  organization_name?: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function SuperAdminJoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const { toast } = useToast();

  useEffect(() => {
    const fetchJoinRequests = async () => {
      try {
        setLoading(true);

        // Fetch all join requests using Super Admin API
        const response = await fetch('/api/super-admin/join-requests');
        if (!response.ok) {
          throw new Error('가입 요청을 불러오는데 실패했습니다');
        }

        const data = await response.json();
        setRequests(data.requests || []);
      } catch (error) {
        console.error('Error fetching join requests:', error);
        toast({
          title: '오류',
          description: error instanceof Error ? error.message : '가입 요청을 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchJoinRequests();
  }, [toast]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'nurse':
        return '스텝';
      case 'doctor':
        return '주치의';
      case 'admin':
        return '관리자';
      default:
        return role;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            대기 중
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            승인됨
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <X className="w-3 h-3 mr-1" />
            거부됨
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">가입 요청 로딩 중...</p>
      </div>
    );
  }

  const filteredRequests = requests.filter((req) => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">가입 요청</h1>
        <p className="text-gray-600">전체 시스템의 가입 요청을 조회합니다 (읽기 전용).</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>대기 중</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인됨</CardDescription>
            <CardTitle className="text-2xl text-green-600">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>거부됨</CardDescription>
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
          전체
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'pending'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          대기 중
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'approved'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          승인됨
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'rejected'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          거부됨
        </button>
      </div>

      {/* Join Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>가입 요청 목록</CardTitle>
          <CardDescription>
            {filteredRequests.length}건의 가입 요청이 검색되었습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>조직</TableHead>
                <TableHead>직군</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>요청일</TableHead>
                <TableHead>처리일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    가입 요청이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.name}</TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{request.organization_name || '-'}</TableCell>
                    <TableCell>{getRoleLabel(request.role)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {request.reviewed_at
                        ? format(new Date(request.reviewed_at), 'yyyy-MM-dd HH:mm')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        참고: Super Admin은 가입 요청을 조회만 할 수 있습니다. 승인/거부는 각 조직의 Admin이 처리합니다.
      </div>
    </div>
  );
}
