'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider-simple';
import { createClient } from '@/lib/supabase/client';
import { isSuperAdmin } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface RequireNonSuperAdminProps {
  children: ReactNode;
}

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>접근 권한 없음</CardTitle>
          <CardDescription>Super Admin은 이 페이지에 접근할 수 없습니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Super Admin은 조직 데이터 및 환자 정보에 접근할 수 없습니다.
            Super Admin 전용 페이지를 이용해주세요.
          </p>
          <Button asChild className="w-full">
            <Link href="/super-admin">Super Admin 대시보드로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequireNonSuperAdmin({ children }: RequireNonSuperAdminProps) {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setIsCheckingRole(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setUserRole(null);
        } else {
          const userProfile = profile as Profile | null;
          setUserRole((userProfile?.role as UserRole) || null);
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole(null);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkUserRole();
  }, [user]);

  // Show loading state while checking auth and role
  if (loading || isCheckingRole) {
    return <LoadingState />;
  }

  // Show access denied if user is super_admin
  if (user && userRole && isSuperAdmin(userRole)) {
    return <AccessDenied />;
  }

  // Render children if user is NOT super_admin (or not logged in - handled by middleware)
  return <>{children}</>;
}
