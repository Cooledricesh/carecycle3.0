'use client'

import { useQuery } from '@tanstack/react-query'
import type { ActivityStats } from '@/types/activity'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'

export function useActivityStats() {
  const { toast } = useToast()

  return useQuery<ActivityStats>({
    queryKey: ['activity', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/activity/stats')

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '통계 조회 실패')
      }

      return response.json()
    },
    refetchInterval: 30000,
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '통계 조회 실패',
        description: message,
        variant: 'destructive',
      })
    },
  })
}