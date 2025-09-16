'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

/**
 * 사이드바 상태를 전역으로 제공하는 Provider
 */
export function SidebarProvider({ children }: SidebarProviderProps) {
  const sidebarState = useSidebarCollapse();

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * 사이드바 Context를 사용하는 훅
 * @throws Context 외부에서 사용 시 에러
 */
export function useSidebar() {
  const context = useContext(SidebarContext);

  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }

  return context;
}