'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { useFilterContext } from '@/lib/filters/filter-context'
import { useAuth } from '@/providers/auth-provider-simple'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { createClient } from '@/lib/supabase/client'

export function useFilteredSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { filters } = useFilterContext()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['schedules', user?.id, filters],
    queryFn: async () => {
      try {
        return await scheduleService.getAllSchedules(filters, supabase)
      } catch (error) {
        console.error('useFilteredSchedules error:', error)
        const message = mapErrorToUserMessage(error)
        toast({
          title: '오류',
          description: message,
          variant: 'destructive'
        })
        throw error
      }
    },
    enabled: !!user && !authLoading
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }

  return {
    schedules: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch
  }
}

export function useFilteredTodayChecklist() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { filters } = useFilterContext()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'today', user?.id, filters],
    queryFn: async () => {
      try {
        return await scheduleService.getTodayChecklist(filters, supabase)
      } catch (error) {
        const message = mapErrorToUserMessage(error)
        toast({
          title: '오류',
          description: message,
          variant: 'destructive'
        })
        throw error
      }
    },
    enabled: !!user && !authLoading
  })
}

export function useFilteredUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { filters } = useFilterContext()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'upcoming', daysAhead, user?.id, filters],
    queryFn: async () => {
      try {
        return await scheduleService.getUpcomingSchedules(daysAhead, filters, supabase)
      } catch (error) {
        const message = mapErrorToUserMessage(error)
        toast({
          title: '오류',
          description: message,
          variant: 'destructive'
        })
        throw error
      }
    },
    enabled: !!user && !authLoading
  })
}