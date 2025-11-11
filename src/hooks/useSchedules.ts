'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import type { ScheduleWithDetails } from '@/types/schedule'
import type { UserContext } from '@/services/filters/types'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile, Profile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
// Removed complex query keys - using simple invalidation

export function useSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['schedules', typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getAllSchedules(typedProfile.organization_id, undefined, supabase)
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
    enabled: !!user && !!typedProfile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof scheduleService.createWithCustomItem>[0]) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await scheduleService.createWithCustomItem(input, typedProfile.organization_id, supabase)
    },
    onSuccess: () => {
      // Invalidate only schedules-related queries
      queryClient.invalidateQueries({ queryKey: ['schedules', typedProfile?.organization_id] })
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
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await scheduleService.markAsCompleted(scheduleId, input, typedProfile.organization_id, supabase)
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
      queryClient.invalidateQueries({ queryKey: ['schedules', typedProfile?.organization_id] })
      toast({
        title: '성공',
        description: '일정이 완료 처리되었습니다.'
      })
    }
  })

  const refetch = () => {
    // Refresh only schedules-related queries
    queryClient.invalidateQueries({ queryKey: ['schedules', typedProfile?.organization_id] })
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
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'today', typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id || !user) {
        throw new Error('Organization ID or User not available')
      }
      try {
        const userContext: UserContext & { organizationId: string } = {
          userId: user.id,
          role: typedProfile.role || 'nurse',
          careType: typedProfile.care_type || null,
          departmentId: typedProfile.department_id || null,
          organizationId: typedProfile.organization_id
        }

        const result = await scheduleServiceEnhanced.getTodayChecklist(
          false, // showAll
          userContext,
          supabase as any
        )
        return result
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
    enabled: !!user && !!typedProfile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function useUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'upcoming', daysAhead, typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id || !user) {
        throw new Error('Organization ID or User not available')
      }
      try {
        const userContext: UserContext & { organizationId: string } = {
          userId: user.id,
          role: typedProfile.role || 'nurse',
          careType: typedProfile.care_type || null,
          departmentId: typedProfile.department_id || null,
          organizationId: typedProfile.organization_id
        }

        const result = await scheduleServiceEnhanced.getUpcomingSchedules(
          daysAhead,
          false, // showAll
          userContext,
          supabase as any
        )
        return result
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
    enabled: !!user && !!typedProfile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function usePatientSchedules(patientId: string) {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'patient', patientId, typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getByPatientId(patientId, typedProfile.organization_id, supabase)
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
    enabled: !!patientId && !!user && !!typedProfile?.organization_id && !loading
  })
}

export function useOverdueSchedules() {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'overdue', typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      try {
        return await scheduleService.getOverdueSchedules(typedProfile.organization_id, supabase)
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
    enabled: !!user && !!typedProfile?.organization_id && !loading,
    staleTime: 0 // Immediate refetch on invalidation
  })
}