'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider-simple';
import { createClient } from '@/lib/supabase/client';
import { isSuperAdmin } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface RequireSuperAdminProps {
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
          <CardDescription>Super Admin 권한이 필요합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            이 페이지는 Super Admin 권한이 필요합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
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

  // Show access denied if not authenticated or not super_admin
  if (!user || !userRole || !isSuperAdmin(userRole)) {
    return <AccessDenied />;
  }

  // Render children if user is super_admin
  return <>{children}</>;
}
