'use client'

import { useQuery } from '@tanstack/react-query'
import type { ActivityFilters, PaginatedAuditLogs } from '@/types/activity'

export function useAuditLogs(filters: ActivityFilters = {}) {
  return useQuery<PaginatedAuditLogs>({
    queryKey: ['activity', 'logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.tableName) params.set('tableName', filters.tableName)
      if (filters.operation) params.set('operation', filters.operation)
      if (filters.page) params.set('page', filters.page.toString())
      if (filters.limit) params.set('limit', filters.limit.toString())

      const response = await fetch(`/api/admin/activity/logs?${params.toString()}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '활동 로그 조회 실패')
      }

      return response.json()
    },
  })
}