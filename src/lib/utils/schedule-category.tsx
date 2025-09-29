import { Clipboard, Syringe } from 'lucide-react'
import type { ItemCategory } from '@/lib/database.types'

/**
 * 카테고리별 아이콘 반환
 * 검사: Clipboard (클립보드 - 모든 검사 유형을 포괄)
 * 주사: Syringe (주사기)
 */
export function getScheduleCategoryIcon(category: ItemCategory | undefined) {
  switch (category) {
    case 'test':
      return Clipboard
    case 'injection':
      return Syringe
    default:
      return null
  }
}

/**
 * 카테고리별 색상 클래스 반환
 * 심플하고 미묘한 구분을 위한 색상
 */
export function getScheduleCategoryColor(category: ItemCategory | undefined) {
  switch (category) {
    case 'test':
      return 'text-emerald-600' // 검사 - 초록색
    case 'injection':
      return 'text-blue-600' // 주사 - 파란색
    default:
      return 'text-gray-600'
  }
}

/**
 * 카테고리 배경색 (매우 연한 색상)
 */
export function getScheduleCategoryBgColor(category: ItemCategory | undefined) {
  switch (category) {
    case 'test':
      return 'bg-emerald-50' // 매우 연한 초록
    case 'injection':
      return 'bg-blue-50' // 매우 연한 파랑
    default:
      return ''
  }
}

/**
 * 카드 전체 배경색 (카드 컨테이너용)
 */
export function getScheduleCardBgColor(category: ItemCategory | undefined) {
  switch (category) {
    case 'test':
      return 'bg-emerald-50/50 hover:bg-emerald-50/70 border-emerald-200' // 반투명 연한 초록
    case 'injection':
      return 'bg-blue-50/50 hover:bg-blue-50/70 border-blue-200' // 반투명 연한 파랑
    default:
      return 'hover:bg-gray-50'
  }
}

/**
 * 카테고리 한글 레이블
 */
export function getScheduleCategoryLabel(category: ItemCategory | undefined): string {
  switch (category) {
    case 'test':
      return '검사'
    case 'injection':
      return '주사'
    case 'other':
      return '기타'
    default:
      return category || ''
  }
}