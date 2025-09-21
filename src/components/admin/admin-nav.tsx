"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  BarChart3, 
  User, 
  LogOut, 
  Menu 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { touchTarget } from "@/lib/utils";

interface AdminNavProps {
  profile: Profile;
}

const navigation = [
  { name: "대시보드", href: "/admin", icon: LayoutDashboard },
  { name: "사용자 관리", href: "/admin/users", icon: Users },
  { name: "스케줄 관리", href: "/admin/schedules", icon: Calendar },
  { name: "보고서", href: "/admin/reports", icon: BarChart3 },
  { name: "설정", href: "/admin/settings", icon: Settings },
  { name: "프로필", href: "/admin/profile", icon: User },
];

export default function AdminNav({ profile }: AdminNavProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/signin');
    } catch (error) {
      console.error("Logout error:", error);
      router.push('/auth/signin');
    }
  };

  // 네비게이션 콘텐츠 (모바일/데스크톱 공통)
  const NavigationContent = () => {
    // Compute safe display name and initial with fallbacks
    const displayName = profile?.name?.trim() || profile?.email || "사용자";
    const initial = displayName.charAt(0).toUpperCase() || "U";

    return (
      <div className="flex h-full flex-col">
        {/* Header - 데스크톱에서만 표시 */}
        <div className="hidden lg:flex h-16 items-center px-6 border-b">
          <h1 className="text-xl font-semibold text-gray-900">관리자 패널</h1>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-red-100 text-red-700">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                관리자
                {profile?.care_type && ` • ${profile.care_type}`}
              </p>
            </div>
          </div>
        </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    w-full flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors
                    min-h-[44px] sm:min-h-[36px]
                    ${
                      isActive
                        ? "bg-red-100 text-red-700"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                  onClick={() => setIsSheetOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quick link to nurse dashboard */}
      <div className="px-4 py-2 border-t border-b">
        <Link
          href="/dashboard"
          className={`flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors ${touchTarget.link}`}
          onClick={() => setIsSheetOpen(false)}
        >
          <Calendar className="mr-3 h-5 w-5" />
          스텝 뷰로 전환
        </Link>
      </div>

        {/* Logout */}
        <div className="px-4 py-4">
          <Button
            variant="ghost"
            className={`w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 ${touchTarget.button}`}
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" />
            로그아웃
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Navigation - Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`fixed top-4 left-4 z-50 lg:hidden ${touchTarget.iconButton}`}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">메뉴 열기</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[350px] p-0 lg:hidden">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>관리자 패널</SheetTitle>
          </SheetHeader>
          <NavigationContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Navigation - Sidebar */}
      <aside className="hidden lg:block fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg">
        <NavigationContent />
      </aside>
    </>
  );
}