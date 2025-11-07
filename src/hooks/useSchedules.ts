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
  const { user, profile, loading } = useAuth()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['schedules', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getAllSchedules(profile.organization_id, undefined, supabase)
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
    enabled: !!user && !!profile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof scheduleService.createWithCustomItem>[0]) => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await scheduleService.createWithCustomItem(input, profile.organization_id, supabase)
    },
    onSuccess: () => {
      // Invalidate only schedules-related queries
      queryClient.invalidateQueries({ queryKey: ['schedules', profile?.organization_id] })
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
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await scheduleService.markAsCompleted(scheduleId, input, profile.organization_id, supabase)
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
      queryClient.invalidateQueries({ queryKey: ['schedules', profile?.organization_id] })
      toast({
        title: '성공',
        description: '일정이 완료 처리되었습니다.'
      })
    }
  })

  const refetch = () => {
    // Refresh only schedules-related queries
    queryClient.invalidateQueries({ queryKey: ['schedules', profile?.organization_id] })
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
  const { user, profile, loading } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'today', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getTodayChecklist(profile.organization_id, undefined, supabase)
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
    enabled: !!user && !!profile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function useUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, profile, loading } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'upcoming', daysAhead, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getUpcomingSchedules(daysAhead, profile.organization_id, undefined, supabase)
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
    enabled: !!user && !!profile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function usePatientSchedules(patientId: string) {
  const { toast } = useToast()
  const { user, profile, loading } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'patient', patientId, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getByPatientId(patientId, profile.organization_id, supabase)
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
    enabled: !!patientId && !!user && !!profile?.organization_id && !loading
  })
}

export function useOverdueSchedules() {
  const { toast } = useToast()
  const { user, profile, loading } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'overdue', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getOverdueSchedules(profile.organization_id, supabase)
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
    enabled: !!user && !!profile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}