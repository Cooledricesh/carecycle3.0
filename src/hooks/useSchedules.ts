'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import type { ScheduleWithDetails } from '@/types/schedule'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuth } from '@/providers/auth-provider-simple'
import { createClient } from '@/lib/supabase/client'
// Removed complex query keys - using simple invalidation

export function useSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['schedules', user?.id],
    queryFn: async () => {
      try {
        return await scheduleService.getAllSchedules(supabase)
      } catch (error) {
        console.error('useSchedules error:', error)
        const message = mapErrorToUserMessage(error)
        toast({
          title: '오류',
          description: message,
          variant: 'destructive'
        })
        throw error
      }
    },
    enabled: !!user && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof scheduleService.createWithCustomItem>[0]) => {
      return await scheduleService.createWithCustomItem(input, supabase)
    },
    onSuccess: () => {
      // Invalidate only schedules-related queries
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
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
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '완료 처리 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSuccess: () => {
      // Invalidate only schedules-related queries
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast({
        title: '성공',
        description: '일정이 완료 처리되었습니다.'
      })
    }
  })

  const refetch = () => {
    // Refresh only schedules-related queries
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
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
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['schedules', 'today', user?.id],
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
    enabled: !!user && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function useUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['schedules', 'upcoming', daysAhead, user?.id],
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
    enabled: !!user && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function usePatientSchedules(patientId: string) {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['schedules', 'patient', patientId, user?.id],
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
    enabled: !!patientId && !!user && !loading
  })
}

export function useOverdueSchedules() {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'overdue', user?.id],
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
    enabled: !!user && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}