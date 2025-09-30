'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Item } from '@/lib/database.types'

export interface ItemFilters {
  searchTerm: string
  category: string
  status: 'all' | 'active' | 'inactive'
  sortBy: 'name' | 'code' | 'category' | 'updated'
  sortOrder: 'asc' | 'desc'
}

const initialFilters: ItemFilters = {
  searchTerm: '',
  category: 'all',
  status: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
}

/**
 * 아이템 필터링 및 정렬을 관리하는 훅
 */
export function useItemFilters(items: Item[]) {
  const [filters, setFilters] = useState<ItemFilters>(initialFilters)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [filters.searchTerm])

  /**
   * 필터링된 아이템 목록
   */
  const filteredItems = useMemo(() => {
    let result = [...items]

    // 검색어 필터
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.code.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      )
    }

    // 카테고리 필터
    if (filters.category !== 'all') {
      result = result.filter(item => item.category === filters.category)
    }

    // 상태 필터
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active'
      result = result.filter(item => item.is_active === isActive)
    }

    // 정렬
    result.sort((a, b) => {
      let comparison = 0

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'code':
          comparison = a.code.localeCompare(b.code)
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
        case 'updated':
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
          comparison = dateB - dateA
          break
        default:
          comparison = 0
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [items, debouncedSearchTerm, filters.category, filters.status, filters.sortBy, filters.sortOrder])

  /**
   * 필터 업데이트 함수들
   */
  const setSearchTerm = useCallback((searchTerm: string) => {
    setFilters(prev => ({ ...prev, searchTerm }))
  }, [])

  const setCategory = useCallback((category: string) => {
    setFilters(prev => ({ ...prev, category }))
  }, [])

  const setStatus = useCallback((status: 'all' | 'active' | 'inactive') => {
    setFilters(prev => ({ ...prev, status }))
  }, [])

  const setSortBy = useCallback((sortBy: ItemFilters['sortBy']) => {
    setFilters(prev => ({ ...prev, sortBy }))
  }, [])

  const setSortOrder = useCallback((sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sortOrder }))
  }, [])

  const toggleSortOrder = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [])

  /**
   * 필터 상태 체크 함수들
   */
  const hasActiveFilters = useMemo(() => {
    return filters.searchTerm !== '' ||
      filters.category !== 'all' ||
      filters.status !== 'all'
  }, [filters])

  const filterCounts = useMemo(() => {
    return {
      total: items.length,
      filtered: filteredItems.length,
      active: items.filter(item => item.is_active).length,
      inactive: items.filter(item => !item.is_active).length,
      byCategory: {
        injection: items.filter(item => item.category === 'injection').length,
        test: items.filter(item => item.category === 'test').length,
        other: items.filter(item => item.category === 'other').length,
      }
    }
  }, [items, filteredItems])

  return {
    // 필터 상태
    filters,
    hasActiveFilters,
    filterCounts,

    // 필터링된 결과
    filteredItems,

    // 필터 업데이트 함수
    setSearchTerm,
    setCategory,
    setStatus,
    setSortBy,
    setSortOrder,
    toggleSortOrder,
    resetFilters,

    // 전체 필터 설정
    setFilters,
  }
}