"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Clock, User, LogOut, Menu, Users } from "lucide-react";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { touchTarget } from "@/lib/utils";

interface DashboardNavProps {
  profile: Profile;
}

const navigation = [
  { name: "내 스케줄", href: "/dashboard", icon: Calendar },
  { name: "환자 관리", href: "/dashboard/patients", icon: Users },
  { name: "스케줄 관리", href: "/dashboard/schedules", icon: Clock },
  { name: "프로필", href: "/dashboard/profile", icon: User },
];

export default function DashboardNav({ profile }: DashboardNavProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    console.log("Logout button clicked");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  // 네비게이션 콘텐츠 (모바일/데스크톱 공통 사용)
  const NavigationContent = () => (
    <div className="flex h-full flex-col">
      {/* Header - 데스크톱에서만 표시 */}
      <div className="hidden lg:flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-semibold text-gray-900">케어스케줄러</h1>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {profile.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {profile.role === "nurse" ? "간호사" : "관리자"}
              {profile.department && ` • ${profile.department}`}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            // Check if current route is active
            // Special handling for the root dashboard path to avoid marking everything active
            let isActive = false;
            
            if (item.href === "/dashboard") {
              // For the root dashboard, only mark active if we're exactly on /dashboard
              // or if no other more specific route matches
              isActive = pathname === "/dashboard" || 
                (!pathname.startsWith("/dashboard/patients") && 
                 !pathname.startsWith("/dashboard/schedules") && 
                 !pathname.startsWith("/dashboard/profile") &&
                 pathname.startsWith("/dashboard"));
            } else {
              // For other routes, check if the current pathname starts with the item's href
              isActive = pathname.startsWith(item.href);
            }
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors
                    ${touchTarget.link}
                    ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                  onClick={() => isMobile && setIsSheetOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t">
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

  // 모바일: Sheet 사용
  if (isMobile) {
    return (
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
        <SheetContent side="left" className="w-[280px] sm:w-[350px] p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>케어스케줄러</SheetTitle>
          </SheetHeader>
          <NavigationContent />
        </SheetContent>
      </Sheet>
    );
  }

  // 데스크톱: 기존 사이드바
  return (
    <aside className="hidden lg:block fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg">
      <NavigationContent />
    </aside>
  );
}