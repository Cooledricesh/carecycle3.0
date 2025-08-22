'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
          
          {/* Content with 12-column grid */}
          <main className="flex-1 bg-gray-50">
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <div className="container max-w-[1200px] mx-auto p-4 lg:p-6">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12">
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