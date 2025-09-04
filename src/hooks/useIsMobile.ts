'use client';

import { useState, useEffect } from 'react';

/**
 * 모바일 디바이스 감지 훅
 * 640px 미만을 모바일로 판정 (Tailwind sm breakpoint)
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // 초기값을 즉시 계산하여 hydration 불일치 방지
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    // SSR 환경에서 window 객체 체크
    if (typeof window === 'undefined') return;

    // 리사이즈 시 체크 함수
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    // 리사이즈 이벤트 핸들러 (디바운싱 포함)
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkIsMobile, 150);
    };

    // 이벤트 리스너 등록
    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}

/**
 * 미디어 쿼리를 사용한 더 정확한 모바일 감지
 * CSS 미디어 쿼리와 동기화
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // 초기값을 즉시 계산하여 hydration 불일치 방지
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    
    // Immediately sync the current state when query changes
    setMatches(media.matches);

    // 미디어 쿼리 변경 감지
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 이벤트 리스너 등록 (호환성 처리)
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // 구형 브라우저 지원
      media.addListener(listener);
    }

    // 클린업
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

// 편의 훅들
export const useIsTablet = () => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsMobileOrTablet = () => useMediaQuery('(max-width: 1023px)');