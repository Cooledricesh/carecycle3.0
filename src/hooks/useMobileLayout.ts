'use client';

import { useState, useEffect, useCallback } from 'react';

type LayoutPreference = 'auto' | 'mobile' | 'desktop';

interface MobileLayoutState {
  preference: LayoutPreference;
  isMobileLayout: boolean;
  setPreference: (pref: LayoutPreference) => void;
  toggleLayout: () => void;
}

const STORAGE_KEY = 'layout-preference';

/**
 * 모바일 레이아웃 관리 훅
 * 사용자의 레이아웃 선호도를 저장하고 관리
 */
export function useMobileLayout(): MobileLayoutState {
  const [preference, setPreferenceState] = useState<LayoutPreference>('auto');
  const [actualWidth, setActualWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // 로컬 스토리지에서 선호도 불러오기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['auto', 'mobile', 'desktop'].includes(stored)) {
      setPreferenceState(stored as LayoutPreference);
    }
  }, []);

  // 실제 너비 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateWidth = () => {
      setActualWidth(window.innerWidth);
    };

    updateWidth();

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 선호도 설정 함수
  const setPreference = useCallback((pref: LayoutPreference) => {
    setPreferenceState(pref);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }, []);

  // 레이아웃 토글 함수
  const toggleLayout = useCallback(() => {
    const nextPref = preference === 'mobile' ? 'desktop' : 'mobile';
    setPreference(nextPref);
  }, [preference, setPreference]);

  // 실제 사용할 레이아웃 결정
  const isMobileLayout = (() => {
    switch (preference) {
      case 'mobile':
        return true;
      case 'desktop':
        return false;
      case 'auto':
      default:
        return actualWidth < 640;
    }
  })();

  return {
    preference,
    isMobileLayout,
    setPreference,
    toggleLayout
  };
}

/**
 * 디바이스 정보를 제공하는 훅
 */
export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState({
    isTouchDevice: false,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent.toLowerCase();
    
    setDeviceInfo({
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isIOS: /iphone|ipad|ipod/.test(userAgent),
      isAndroid: /android/.test(userAgent),
      isSafari: /safari/.test(userAgent) && !/chrome/.test(userAgent),
      isChrome: /chrome/.test(userAgent) && !/edg/.test(userAgent)
    });
  }, []);

  return deviceInfo;
}