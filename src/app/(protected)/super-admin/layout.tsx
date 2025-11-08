'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireSuperAdmin } from '@/components/super-admin/RequireSuperAdmin';
import { Building2, Users, UserCheck, LayoutDashboard } from 'lucide-react';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: '대시보드', href: '/super-admin', icon: LayoutDashboard },
  { name: '조직 관리', href: '/super-admin/organizations', icon: Building2 },
  { name: '사용자 관리', href: '/super-admin/users', icon: Users },
  { name: '가입 요청', href: '/super-admin/join-requests', icon: UserCheck },
];

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname();

  return (
    <RequireSuperAdmin>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
              <div className="text-sm text-gray-600">시스템 관리</div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4">
            <div className="flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors
                      ${isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </RequireSuperAdmin>
  );
}
