'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sidebar-collapsed';

interface SidebarCollapseState {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * 사이드바 축소/확장 상태를 관리하는 훅
 * localStorage를 통해 사용자 설정을 영속화
 */
export function useSidebarCollapse(): SidebarCollapseState {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // localStorage에서 상태 불러오기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let stored: string | null = null;

    try {
      stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch (error) {
      // Safari private mode 등에서 localStorage 접근 시 예외 발생 가능
      console.warn('Failed to load sidebar collapse state from localStorage:', error);
    }

    setIsHydrated(true);
  }, []);

  // localStorage에 상태 저장
  const persistState = useCallback((collapsed: boolean) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch (error) {
      // Safari private mode 등에서 localStorage 쓰기 시 예외 발생 가능
      console.warn('Failed to persist sidebar collapse state to localStorage:', error);
    }
  }, []);

  // 상태 설정 함수
  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    persistState(collapsed);
  }, [persistState]);

  // 토글 함수
  const toggleCollapse = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  return {
    isCollapsed: isHydrated ? isCollapsed : false,
    toggleCollapse,
    setCollapsed
  };
}