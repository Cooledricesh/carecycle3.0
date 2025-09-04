'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/useIsMobile';
import { responsivePadding } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 xl:w-72 border-r bg-background">
          <Sidebar />
        </aside>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <Header />
          
          {/* Content with responsive padding */}
          <main className="flex-1 bg-gray-50">
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <div className={`container max-w-[1200px] mx-auto ${responsivePadding.page}`}>
                <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-12 gap-4'}`}>
                  <div className={isMobile ? 'w-full' : 'col-span-12'}>
                    {children}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </main>
          
          <Footer />
        </div>
      </div>
    </div>
  );
}