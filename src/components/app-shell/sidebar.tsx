'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  User, 
  LogOut, 
  Users, 
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/providers/auth-provider-simple';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navigation: NavItem[] = [
  { name: '내 스케줄', href: '/dashboard', icon: Calendar },
  { name: '환자 관리', href: '/dashboard/patients', icon: Users },
  { name: '스케줄 관리', href: '/dashboard/schedules', icon: Clock },
  { name: '항목 관리', href: '/dashboard/items', icon: List },
  { name: '프로필', href: '/dashboard/profile', icon: User },
];

const adminNavigation: NavItem[] = [
  { name: '관리자 대시보드', href: '/admin', icon: Settings, roles: ['admin'] },
  { name: '사용자 관리', href: '/admin/users', icon: UserCog, roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Simplified: Create profile from user data without fetching from database
  // The profiles table query was causing issues - see AUTH_FAILURE_ANALYSIS.md
  const profile = user ? {
    id: user.id,
    name: user.email?.split('@')[0] || 'User',
    email: user.email,
    role: 'nurse' as const,
    department: null,
    created_at: '',
    updated_at: ''
  } : null;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  // Show all basic navigation if no profile, add admin navigation if admin
  const userRole = profile?.role || 'nurse';
  
  const allNavigation = userRole === 'admin' 
    ? [...navigation, ...adminNavigation] 
    : navigation;

  // Filter navigation based on roles if specified
  const filteredNavigation = allNavigation.filter(item => {
    // If no roles specified, show to everyone
    if (!item.roles) return true;
    // If profile exists, check role
    if (profile) return item.roles.includes(profile.role);
    // If no profile, only show items without role restriction
    return !item.roles || item.roles.includes('nurse');
  });

  // Remove loading screen - show sidebar even while loading

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b">
        {!isCollapsed && (
          <h1 className="text-xl font-semibold text-gray-900">케어스케줄러</h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="hidden xl:flex"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* User info */}
      <div className={`px-6 py-4 border-b ${isCollapsed ? 'px-3' : ''}`}>
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>
              {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name || user?.email?.split('@')[0] || '사용자'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile ? (
                  <>
                    {profile.role === 'nurse' ? '간호사' : '관리자'}
                    {profile.department && ` • ${profile.department}`}
                  </>
                ) : user ? (
                  <span className="text-amber-600">프로필 설정 필요</span>
                ) : (
                  '로그인 필요'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Profile warning */}
      {user && !profile && !loading && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="text-xs text-amber-800">
            프로필이 없습니다. 
            <Link href="/debug/profile" className="underline font-medium">
              여기서 생성하세요
            </Link>
          </p>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="px-4 py-4">
          <ul className="space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || 
                              (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <item.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollArea>

      <Separator />

      {/* Logout */}
      <div className="px-4 py-4">
        <Button
          variant="ghost"
          className={`w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          onClick={handleSignOut}
          title={isCollapsed ? '로그아웃' : undefined}
        >
          <LogOut className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && '로그아웃'}
        </Button>
      </div>
    </div>
  );
}