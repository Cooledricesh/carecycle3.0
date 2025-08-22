'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import type { ScheduleWithDetails } from '@/types/schedule'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuthContext } from '@/providers/auth-provider'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { queryKeys, getRelatedQueryKeys } from '@/lib/query-keys'

export function useSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()

  const query = useQuery({
    queryKey: queryKeys.schedules.lists(),
    queryFn: async () => {
      try {
        return await scheduleService.getAllSchedules(supabase)
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
    enabled: initialized && !!user,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  })

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof scheduleService.createWithCustomItem>[0]) => {
      return await scheduleService.createWithCustomItem(input, supabase)
    },
    onSuccess: () => {
      // Invalidate all schedule-related queries
      const keysToInvalidate = getRelatedQueryKeys('schedule.create')
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      toast({
        title: '성공',
        description: '일정이 성공적으로 등록되었습니다.'
      })
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '일정 등록 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  const markCompletedMutation = useMutation({
    mutationFn: async ({ scheduleId, ...input }: { scheduleId: string } & Parameters<typeof scheduleService.markAsCompleted>[1]) => {
      return await scheduleService.markAsCompleted(scheduleId, input, supabase)
    },
    onSuccess: () => {
      // Invalidate all schedule-related queries for proper sync
      const keysToInvalidate = getRelatedQueryKeys('schedule.complete')
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      toast({
        title: '성공',
        description: '일정이 완료 처리되었습니다.'
      })
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '완료 처리 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  const refetch = () => {
    // Invalidate all schedule queries
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all })
  }

  return {
    schedules: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    createSchedule: createMutation.mutate,
    isCreating: createMutation.isPending,
    markAsCompleted: markCompletedMutation.mutate,
    isMarkingCompleted: markCompletedMutation.isPending
  }
}

export function useTodayChecklist() {
  const { toast } = useToast()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.schedules.today(),
    queryFn: async () => {
      try {
        return await scheduleService.getTodayChecklist(supabase)
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
    enabled: initialized && !!user,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000 // Refetch every minute
  })
}

export function useUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.schedules.upcoming(daysAhead),
    queryFn: async () => {
      try {
        return await scheduleService.getUpcomingSchedules(daysAhead, supabase)
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
    enabled: initialized && !!user,
    retry: 1,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function usePatientSchedules(patientId: string) {
  const { toast } = useToast()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.schedules.byPatient(patientId),
    queryFn: async () => {
      try {
        return await scheduleService.getByPatientId(patientId, supabase)
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
    enabled: initialized && !!user && !!patientId,
    retry: 1,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useOverdueSchedules() {
  const { toast } = useToast()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.schedules.overdue(),
    queryFn: async () => {
      try {
        return await scheduleService.getOverdueSchedules(supabase)
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
    enabled: initialized && !!user,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
  })
}