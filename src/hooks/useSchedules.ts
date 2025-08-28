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
        console.error('useSchedules error:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          user: user?.id
        })
        const message = mapErrorToUserMessage(error)
        toast({
          title: '오류',
          description: message,
          variant: 'destructive'
        })
        throw error
      }
    },
    enabled: true, // Remove auth blocking for immediate loading
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // 30 seconds for more frequent updates
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
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
    onMutate: async ({ scheduleId }) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.schedules.all })
      await queryClient.cancelQueries({ queryKey: queryKeys.executions.all })
      
      // Snapshot previous values for rollback
      const previousSchedules = queryClient.getQueryData(queryKeys.schedules.lists())
      const previousToday = queryClient.getQueryData(queryKeys.schedules.today())
      const previousUpcoming = queryClient.getQueryData(queryKeys.schedules.upcoming())
      
      // Optimistically remove completed schedule from today's list
      queryClient.setQueryData(queryKeys.schedules.today(), (old: ScheduleWithDetails[] = []) => 
        old.filter(schedule => schedule.id !== scheduleId)
      )
      
      // Optimistically update upcoming schedules
      queryClient.setQueryData(queryKeys.schedules.upcoming(), (old: ScheduleWithDetails[] = []) => 
        old.filter(schedule => schedule.id !== scheduleId)
      )
      
      // Return context for rollback
      return { previousSchedules, previousToday, previousUpcoming }
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(queryKeys.schedules.lists(), context.previousSchedules)
        queryClient.setQueryData(queryKeys.schedules.today(), context.previousToday)
        queryClient.setQueryData(queryKeys.schedules.upcoming(), context.previousUpcoming)
      }
      
      const message = mapErrorToUserMessage(error)
      toast({
        title: '완료 처리 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      const keysToInvalidate = getRelatedQueryKeys('schedule.complete')
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
    onSuccess: () => {
      toast({
        title: '성공',
        description: '일정이 완료 처리되었습니다.'
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
    enabled: true, // Remove auth blocking for immediate loading
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // 30 seconds for more frequent updates
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
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
    enabled: true, // Remove auth blocking for immediate loading
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // 30 seconds for more frequent updates
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
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
    enabled: !!patientId, // Only check if patientId exists
    retry: 1,
    staleTime: 5 * 60 * 1000 // 5 minutes - rely on realtime sync
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
    enabled: true, // Remove auth blocking for immediate loading
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // 30 seconds for more frequent updates
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
  })
}