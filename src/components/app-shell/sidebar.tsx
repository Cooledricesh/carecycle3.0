'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  Clock,
  User,
  LogOut,
  Users,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  List,
  Building2,
  UserPlus,
  LayoutDashboard
} from 'lucide-react';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/providers/auth-provider-simple';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useProfile, Profile } from '@/hooks/useProfile';
import { useSidebar } from '@/providers/sidebar-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navigation: NavItem[] = [
  { name: '내 스케줄', href: '/dashboard', icon: Calendar },
  { name: '캘린더 보기', href: '/dashboard/calendar', icon: CalendarDays },
  { name: '환자 관리', href: '/dashboard/patients', icon: Users },
  { name: '스케줄 관리', href: '/dashboard/schedules', icon: Clock },
  { name: '항목 관리', href: '/dashboard/items', icon: List },
  { name: '프로필', href: '/dashboard/profile', icon: User },
];

const adminNavigation: NavItem[] = [
  { name: '관리자 대시보드', href: '/admin', icon: Settings, roles: ['admin'] },
  { name: '사용자 관리', href: '/admin/users', icon: UserCog, roles: ['admin'] },
];

const superAdminNavigation: NavItem[] = [
  { name: '대시보드', href: '/super-admin', icon: LayoutDashboard },
  { name: '조직 관리', href: '/super-admin/organizations', icon: Building2 },
  { name: '사용자 관리', href: '/super-admin/users', icon: Users },
  { name: '가입 요청', href: '/super-admin/join-requests', icon: UserPlus },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { isCollapsed, toggleCollapse } = useSidebar();

  // Prevent hydration mismatch by deferring pathname-based logic until after hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loading = authLoading || profileLoading;

  const handleSignOut = async () => {
    console.log('[Sidebar Debug] Logout initiated');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const supabase = createClient();

      // Add timeout protection for sign out (5 seconds)
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Sign out timeout')), 5000);
      });

      await Promise.race([signOutPromise, timeoutPromise]);
      console.log('[Sidebar Debug] Logout successful via Supabase');
    } catch (error: any) {
      console.error('[Sidebar Debug] Logout failed or timed out:', error.message);
      // Fallback: clear storage manually
      console.log('[Sidebar Debug] Clearing storage manually as fallback');
      localStorage.clear();
      sessionStorage.clear();
      // Clear supabase cookies
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim();
        if (cookieName.startsWith('sb-')) {
          document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      });
    } finally {
      // Clean up timeout to prevent memory leak
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      // Always redirect to sign in, regardless of success/failure
      console.log('[Sidebar Debug] Redirecting to signin');
      router.push('/auth/signin');
    }
  };

  const typedProfile = profile as Profile | null | undefined;

  // Show all basic navigation if no profile, add admin navigation if admin
  const userRole = typedProfile?.role || 'nurse';

  // Determine navigation based on role
  let allNavigation: NavItem[];
  if (userRole === 'super_admin') {
    // Super Admin sees only super admin navigation
    allNavigation = superAdminNavigation;
  } else if (userRole === 'admin') {
    // Admin sees regular navigation + admin navigation
    allNavigation = [...navigation, ...adminNavigation];
  } else {
    // Regular users see only basic navigation
    allNavigation = navigation;
  }

  // Filter navigation based on roles if specified
  const filteredNavigation = allNavigation.filter(item => {
    // If no roles specified, show to everyone
    if (!item.roles) return true;
    // If profile exists, check role
    if (typedProfile) return item.roles.includes(typedProfile.role);
    // If no profile, only show items without role restriction
    return !item.roles || item.roles.includes('nurse');
  });

  // Remove loading screen - show sidebar even while loading

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b">
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            <AppIcon size="sm" />
            <h1 className="text-xl font-semibold text-gray-900">케어스케줄러</h1>
          </div>
        ) : (
          <div className="mx-auto">
            <AppIcon size="sm" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="hidden xl:flex"
          onClick={toggleCollapse}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* User info */}
      <div className={`px-6 py-4 border-b ${isCollapsed ? 'px-3' : ''}`}>
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>
              {typedProfile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {typedProfile?.name || user?.email?.split('@')[0] || '사용자'}
              </p>
              <div className="space-y-0.5">
                {typedProfile ? (
                  <>
                    <p className="text-xs text-gray-500 truncate">
                      {typedProfile.organization_name || '미지정'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {typedProfile.role === 'nurse' ? '스텝' :
                       typedProfile.role === 'doctor' ? '의사' :
                       typedProfile.role === 'admin' ? '관리자' :
                       typedProfile.role === 'super_admin' ? 'Super Admin' : '사용자'}
                      {typedProfile.department_name && ` • ${typedProfile.department_name}`}
                    </p>
                  </>
                ) : user ? (
                  <p className="text-xs text-amber-600">프로필 설정 필요</p>
                ) : (
                  <p className="text-xs text-gray-500">로그인 필요</p>
                )}
              </div>
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

      {/* Navigation and Logout */}
      <ScrollArea className="flex-1">
        <nav className="px-4 py-4">
          <ul className="space-y-2">
            {filteredNavigation.map((item) => {
              // Check if current route is active - only after hydration to prevent mismatch
              let isActive = false;

              if (isHydrated) {
                // Define section roots that should only match exactly
                const sectionRoots = ['/dashboard', '/admin', '/super-admin'];

                if (sectionRoots.includes(item.href)) {
                  // For section roots, only mark active on exact match
                  isActive = pathname === item.href;
                } else {
                  // For other routes, use strict prefix matching with trailing slash
                  // This prevents '/schedules' from matching '/schedules-old'
                  isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                }
              }

              const linkContent = (
                <Link
                  href={item.href}
                  onClick={() => {
                    // Call onNavigate callback when link is clicked (for mobile auto-close)
                    onNavigate?.();
                  }}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all
                    min-h-[48px] duration-150
                    ${isActive
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700 pl-3'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 active:scale-[0.98]'
                    }
                    ${isCollapsed ? 'justify-center px-3' : ''}
                  `}
                >
                  <item.icon className={`h-6 w-6 flex-shrink-0 ${isCollapsed ? '' : 'mr-4'}`} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );

              return (
                <li key={item.name}>
                  {isCollapsed ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    linkContent
                  )}
                </li>
              );
            })}
          </ul>

          {/* Separator and Logout moved inside ScrollArea */}
          <div className="mt-4 pt-4 border-t">
            {isCollapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-center px-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>로그아웃</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5 mr-3" />
                로그아웃
              </Button>
            )}
          </div>
        </nav>
      </ScrollArea>
    </div>
  );
}