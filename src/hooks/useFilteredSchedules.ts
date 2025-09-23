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
import type { UserContext } from '@/services/filters/types'

export function useFilteredSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()


  const query = useQuery({
    queryKey: ['schedules', user?.id, filters, profile?.role, profile?.care_type], // Fixed: care_type not careType
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
        console.error('[useFilteredSchedules] Query error:', error)
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

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
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
    queryKey: ['schedules', 'today', user?.id, filters, profile?.role],
    queryFn: async () => {
      try {
        console.log('[useFilteredTodayChecklist] Starting query:', {
          hasUser: !!user,
          hasProfile: !!profile,
          profileRole: profile?.role,
          showAll: filters.showAll
        })

        // Use enhanced service for today's checklist
        if (user && profile) {
          const userContext: UserContext = {
            userId: user.id,
            role: profile.role || 'nurse',
            careType: profile.care_type || null
          }

          console.log('[useFilteredTodayChecklist] Using enhanced service with showAll:', filters.showAll)

          const result = await scheduleServiceEnhanced.getTodayChecklist(
            filters.showAll || false,
            userContext,
            supabase
          )

          console.log('[useFilteredTodayChecklist] Enhanced service result:', {
            count: result.length,
            userContext
          })

          return result
        }

        // Fallback to old service
        console.log('[useFilteredTodayChecklist] Falling back to old service')
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
    queryKey: ['schedules', 'upcoming', daysAhead, user?.id, filters, profile?.role, profile?.care_type],
    queryFn: async () => {
      try {
        console.log('[useFilteredUpcomingSchedules] Profile check:', {
          hasProfile: !!profile,
          role: profile?.role,
          careType: profile?.care_type,
          showAll: filters.showAll
        })

        if (!profile || !user) {
          console.log('[useFilteredUpcomingSchedules] Waiting for profile or user...')
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
            console.log('[useFilteredUpcomingSchedules] Filtered for nurse:', {
              careType: profile.care_type,
              originalCount: allSchedules.length,
              filteredCount: filtered.length
            })
            return filtered
          } else if (profile.role === 'doctor') {
            // Filter by doctor_id for doctors
            // Handle both possible property names (patients or patient)
            const filtered = allSchedules.filter((schedule: any) =>
              (schedule.patients?.doctor_id === user.id) ||
              (schedule.patient?.doctorId === user.id) ||
              (schedule.patient?.doctor_id === user.id)
            )
            console.log('[useFilteredUpcomingSchedules] Filtered for doctor:', {
              doctorId: user.id,
              originalCount: allSchedules.length,
              filteredCount: filtered.length
            })
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