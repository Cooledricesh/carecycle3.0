'use client'

import { useQuery } from '@tanstack/react-query'
import { getAllItems, getItemById } from '@/lib/api/items'
import type { Item } from '@/lib/database.types'

/**
 * 전체 아이템 목록을 가져오는 훅
 */
export function useItems() {
  const query = useQuery({
    queryKey: ['items'],
    queryFn: getAllItems,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분 (이전 cacheTime)
  })

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * 특정 아이템을 가져오는 훅
 */
export function useItem(id: string | null) {
  const query = useQuery({
    queryKey: ['items', id],
    queryFn: () => getItemById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    item: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * 활성 아이템만 가져오는 훅
 */
export function useActiveItems() {
  const { items, ...rest } = useItems()

  const activeItems = items.filter(item => item.is_active === true)

  return {
    items: activeItems,
    ...rest,
  }
}

/**
 * 카테고리별 아이템을 가져오는 훅
 */
export function useItemsByCategory(category: string | 'all') {
  const { items, ...rest } = useItems()

  const filteredItems = category === 'all'
    ? items
    : items.filter(item => item.category === category)

  return {
    items: filteredItems,
    ...rest,
  }
}

/**
 * 아이템 통계를 계산하는 훅
 */
export function useItemsStatistics() {
  const { items, isLoading } = useItems()

  const statistics = {
    total: items.length,
    active: items.filter(item => item.is_active).length,
    inactive: items.filter(item => !item.is_active).length,
    byCategory: {
      injection: items.filter(item => item.category === 'injection').length,
      test: items.filter(item => item.category === 'test').length,
      treatment: items.filter(item => item.category === 'treatment').length,
      medication: items.filter(item => item.category === 'medication').length,
      other: items.filter(item => item.category === 'other').length,
    },
    withNotification: items.filter(item => item.requires_notification).length,
  }

  return {
    statistics,
    isLoading,
  }
}