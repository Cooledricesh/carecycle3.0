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
import { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/signin');
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect to landing page even on error
      router.push('/auth/signin');
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-4 left-4 z-50"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-200 ease-in-out
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <h1 className="text-xl font-semibold text-gray-900">관리자 패널</h1>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ×
            </Button>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback className="bg-red-100 text-red-700">
                  {profile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  관리자
                  {profile.department && ` • ${profile.department}`}
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
                        flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                        ${
                          isActive
                            ? "bg-red-100 text-red-700"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        }
                      `}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
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
              className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Calendar className="mr-3 h-5 w-5" />
              간호사 뷰로 전환
            </Link>
          </div>

          {/* Logout */}
          <div className="px-4 py-4">
            <button
              type="button"
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-5 w-5" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}