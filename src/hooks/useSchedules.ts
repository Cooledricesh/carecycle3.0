'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import type { ScheduleWithDetails } from '@/types/schedule'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'

export function useSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      try {
        return await scheduleService.getAllSchedules()
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
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  })

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof scheduleService.createWithCustomItem>[0]) => {
      return await scheduleService.createWithCustomItem(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['todayChecklist'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingSchedules'] })
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
      return await scheduleService.markAsCompleted(scheduleId, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['todayChecklist'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingSchedules'] })
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
  
  return useQuery({
    queryKey: ['todayChecklist'],
    queryFn: async () => {
      try {
        return await scheduleService.getTodayChecklist()
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
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000 // Refetch every minute
  })
}

export function useUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  
  return useQuery({
    queryKey: ['upcomingSchedules', daysAhead],
    queryFn: async () => {
      try {
        return await scheduleService.getUpcomingSchedules(daysAhead)
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
    retry: 1,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function usePatientSchedules(patientId: string) {
  const { toast } = useToast()
  
  return useQuery({
    queryKey: ['schedules', 'patient', patientId],
    queryFn: async () => {
      try {
        return await scheduleService.getByPatientId(patientId)
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
    enabled: !!patientId,
    retry: 1,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useOverdueSchedules() {
  const { toast } = useToast()
  
  return useQuery({
    queryKey: ['overdueSchedules'],
    queryFn: async () => {
      try {
        return await scheduleService.getOverdueSchedules()
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
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
  })
}