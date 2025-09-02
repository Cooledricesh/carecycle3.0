'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 안전하게 날짜를 파싱하고 포맷하는 유틸리티 함수
 * @param dateString - 날짜 문자열
 * @param formatString - date-fns format 문자열
 * @param fallback - 오류 시 반환할 기본값
 * @returns 포맷된 날짜 문자열 또는 기본값
 */
export function safeFormatDate(
  dateString: string | null | undefined,
  formatString: string = 'yyyy년 MM월 dd일',
  fallback: string = '날짜 없음'
): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    
    // Invalid Date 체크
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', dateString);
      return fallback;
    }
    
    // 날짜가 너무 과거이거나 미래인 경우 체크 (1900-2100년)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn('Date out of reasonable range:', dateString);
      return fallback;
    }
    
    return format(date, formatString, { locale: ko });
  } catch (error) {
    console.error('Date formatting error:', error, dateString);
    return fallback;
  }
}

/**
 * 안전하게 날짜를 파싱하는 함수
 * @param dateString - 날짜 문자열
 * @returns Date 객체 또는 null
 */
export function safeParse(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    
    // Invalid Date 체크
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // 날짜가 너무 과거이거나 미래인 경우 체크
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    return date;
  } catch {
    return null;
  }
}

/**
 * 두 날짜 사이의 일수 차이 계산
 * @param date1 - 첫 번째 날짜
 * @param date2 - 두 번째 날짜
 * @returns 일수 차이 또는 null
 */
export function getDaysDifference(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): number | null {
  const d1 = typeof date1 === 'string' ? safeParse(date1) : date1;
  const d2 = typeof date2 === 'string' ? safeParse(date2) : date2;
  
  if (!d1 || !d2) return null;
  
  return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 주 단위를 일 단위로 변환
 * @param weeks - 주 수
 * @returns 일 수
 */
export function weeksToDays(weeks: number): number {
  return weeks * 7;
}

/**
 * 일 단위를 주 단위로 변환
 * @param days - 일 수
 * @returns 주 수
 */
export function daysToWeeks(days: number): number {
  return Math.floor(days / 7);
}

/**
 * 날짜에 주 단위 더하기
 * @param date - 기준 날짜
 * @param weeks - 더할 주 수
 * @returns 새로운 날짜 또는 null
 */
export function addWeeks(date: Date | string | null | undefined, weeks: number): Date | null {
  const d = typeof date === 'string' ? safeParse(date) : date;
  if (!d) return null;
  
  const newDate = new Date(d);
  newDate.setDate(newDate.getDate() + weeksToDays(weeks));
  return newDate;
}