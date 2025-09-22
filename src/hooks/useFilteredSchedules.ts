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
    queryKey: ['schedules', 'upcoming', daysAhead, user?.id, filters, profile?.role],
    queryFn: async () => {
      try {
        console.log('[useFilteredUpcomingSchedules] Profile check:', {
          hasProfile: !!profile,
          role: profile?.role
        })

        // For now, use the old service for upcoming schedules
        // Enhanced service can be extended later for this specific view
        // But wait for profile to be loaded before running
        if (!profile) {
          console.log('[useFilteredUpcomingSchedules] Waiting for profile...')
          return []
        }

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
    enabled: !!user && !authLoading && !!profile && !profileLoading
  })
}