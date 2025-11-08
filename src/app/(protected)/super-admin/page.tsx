'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserPlus } from 'lucide-react';

interface Stats {
  organizations: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    by_role: {
      admin: number;
      doctor: number;
      nurse: number;
    };
  };
  join_requests: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/super-admin/stats');

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">통계 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>에러 발생</CardTitle>
            <CardDescription>통계를 불러올 수 없습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">시스템 전체 관리 대시보드</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Organizations Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">조직</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.organizations.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              활성: {stats?.organizations.active || 0} | 비활성: {stats?.organizations.inactive || 0}
            </p>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              관리자: {stats?.users.by_role.admin || 0} |
              의사: {stats?.users.by_role.doctor || 0} |
              간호사: {stats?.users.by_role.nurse || 0}
            </p>
          </CardContent>
        </Card>

        {/* Join Requests Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">가입 요청</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.join_requests.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              승인: {stats?.join_requests.approved || 0} |
              거절: {stats?.join_requests.rejected || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>빠른 작업</CardTitle>
            <CardDescription>자주 사용하는 관리 기능</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/super-admin/organizations"
                className="flex items-center gap-2 rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <Building2 className="h-5 w-5" />
                <div>
                  <p className="font-medium">조직 관리</p>
                  <p className="text-sm text-muted-foreground">조직 생성, 수정, 비활성화</p>
                </div>
              </Link>
              <Link
                href="/super-admin/users"
                className="flex items-center gap-2 rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <Users className="h-5 w-5" />
                <div>
                  <p className="font-medium">사용자 관리</p>
                  <p className="text-sm text-muted-foreground">사용자 역할 변경, 비활성화</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
