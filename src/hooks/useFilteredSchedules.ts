'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { useFilterContext } from '@/lib/filters/filter-context'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { createClient } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query-keys'
import type { UserContext } from '@/services/filters/types'

export function useFilteredSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()


  const query = useQuery({
    queryKey: ['schedules'], // Simplified key for proper invalidation
    queryFn: async () => {
      try {
        // Always try to get schedules, even without full profile
        if (user) {
          // Wait for profile if it's still loading
          if (profileLoading) {
            return []
          }

          // Use enhanced service with whatever info we have
          const userContext: UserContext = {
            userId: user.id,
            role: profile?.role || 'doctor',
            careType: profile?.care_type || null
          }

          const result = await scheduleServiceEnhanced.getFilteredSchedules(
            {
              ...filters,
              showAll: filters.showAll || false
            },
            userContext,
            supabase
          )

          return result.schedules
        }

        // No user at all
        return []
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
    // Temporarily relaxed condition for debugging
    enabled: !!user && !authLoading
  })

  const refetch = async () => {
    // 캐시 완전히 제거
    scheduleServiceEnhanced.clearCache();

    // 단순한 키로 무효화
    await queryClient.invalidateQueries({ queryKey: ['schedules'] });
    await queryClient.invalidateQueries({ queryKey: ['executions'] });

    // 강제 refetch
    await query.refetch();

    return true;
  }

  return {
    schedules: query.data || [],
    isLoading: query.isLoading || profileLoading,
    error: query.error,
    refetch
  }
}

export function useFilteredTodayChecklist() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'today'], // Simplified key
    queryFn: async () => {
      try {
        // Use enhanced service for today's checklist
        if (user && profile) {
          const userContext: UserContext = {
            userId: user.id,
            role: profile.role || 'nurse',
            careType: profile.care_type || null
          }

          const result = await scheduleServiceEnhanced.getTodayChecklist(
            filters.showAll || false,
            userContext,
            supabase
          )

          return result
        }

        // Fallback to old service
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
    enabled: !!user && !authLoading && !!profile && !profileLoading
  })
}

export function useFilteredUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'upcoming', daysAhead], // Simplified key
    queryFn: async () => {
      try {
        if (!profile || !user) {
          return []
        }

        // Get all schedules first
        const allSchedules = await scheduleService.getUpcomingSchedules(daysAhead, filters, supabase)

        // Apply role-based filtering if showAll is false
        if (!filters.showAll) {
          if (profile.role === 'nurse' && profile.care_type) {
            // Filter by care_type for nurses
            // Handle both possible property names (patients or patient)
            const filtered = allSchedules.filter((schedule: any) =>
              (schedule.patients?.care_type === profile.care_type) ||
              (schedule.patient?.careType === profile.care_type) ||
              (schedule.patient?.care_type === profile.care_type)
            )
            return filtered
          } else if (profile.role === 'doctor') {
            // Filter by doctor_id for doctors
            // Handle both possible property names (patients or patient)
            const filtered = allSchedules.filter((schedule: any) =>
              (schedule.patients?.doctor_id === user.id) ||
              (schedule.patient?.doctorId === user.id) ||
              (schedule.patient?.doctor_id === user.id)
            )
            return filtered
          }
        }

        // Admin or showAll = true: return all schedules
        return allSchedules
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
    enabled: !!user && !authLoading && !!profile && !profileLoading
  })
}