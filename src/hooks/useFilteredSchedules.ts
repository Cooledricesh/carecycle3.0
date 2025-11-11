'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { useFilterContext, useIsFilterContextAvailable } from '@/lib/filters/filter-context'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile, Profile } from '@/hooks/useProfile'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { createClient } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query-keys'
import { defaultFilters, type ScheduleFilter } from '@/lib/filters/filter-types'
import type { UserContext } from '@/services/filters/types'

export function useFilteredSchedules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const isFilterAvailable = useIsFilterContextAvailable()
  // Always call the hook unconditionally
  const filterContext = useFilterContext()
  // Then use conditional logic on the returned value
  const filters: ScheduleFilter = isFilterAvailable ? filterContext.filters : { ...defaultFilters, showAll: false }
  const supabase = createClient()


  const query = useQuery({
    queryKey: ['schedules', typedProfile?.organization_id, user?.id, typedProfile?.role, filters.showAll], // Include filter state in key
    queryFn: async () => {
      try {
        // Always try to get schedules, even without full profile
        if (user && typedProfile?.organization_id) {
          // Wait for profile if it's still loading
          if (profileLoading) {
            return []
          }

          // Use enhanced service with whatever info we have
          const userContext: UserContext & { organizationId: string } = {
            userId: user.id,
            role: typedProfile?.role || 'doctor',
            careType: typedProfile?.care_type || null,
            organizationId: typedProfile.organization_id
          }

          const result = await scheduleServiceEnhanced.getFilteredSchedules(
            {
              ...filters,
              showAll: filters.showAll || false
            },
            userContext,
            supabase as any
          )

          return result.schedules
        }

        // No user or organization_id
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
    enabled: !!user && !authLoading && !!typedProfile?.organization_id,
    staleTime: 0 // Immediate refetch on invalidation
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
  const typedProfile = profile as Profile | null | undefined
  const isFilterAvailable = useIsFilterContextAvailable()
  // Always call the hook unconditionally
  const filterContext = useFilterContext()
  // Then use conditional logic on the returned value
  const filters = isFilterAvailable ? filterContext.filters : defaultFilters
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'today', typedProfile?.organization_id, filters.showAll], // Include filter state in key
    queryFn: async () => {
      try {
        // Use enhanced service for today's checklist
        if (user && typedProfile && typedProfile.organization_id) {
          const userContext: UserContext & { organizationId: string } = {
            userId: user.id,
            role: typedProfile.role || 'nurse',
            careType: typedProfile.care_type || null,
            organizationId: typedProfile.organization_id
          }

          const result = await scheduleServiceEnhanced.getTodayChecklist(
            filters.showAll || false,
            userContext,
            supabase as any
          )

          return result
        }

        // No organization_id available
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
    enabled: !!user && !authLoading && !!typedProfile && !profileLoading && !!typedProfile?.organization_id,
    staleTime: 0 // Immediate refetch on invalidation
  })
}

export function useFilteredUpcomingSchedules(daysAhead: number = 7) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const isFilterAvailable = useIsFilterContextAvailable()
  // Always call the hook unconditionally
  const filterContext = useFilterContext()
  // Then use conditional logic on the returned value
  const filters: ScheduleFilter = isFilterAvailable ? filterContext.filters : { ...defaultFilters, showAll: false }
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedules', 'upcoming', typedProfile?.organization_id, daysAhead, filters.showAll], // Include filter state in key
    queryFn: async () => {
      try {
        if (!typedProfile || !user || !typedProfile.organization_id) {
          return []
        }

        // Use enhanced service for upcoming schedules (same JOIN pattern as getTodayChecklist)
        const userContext: UserContext & { organizationId: string } = {
          userId: user.id,
          role: typedProfile.role || 'nurse',
          careType: typedProfile.care_type || null,
          departmentId: typedProfile.department_id || null,
          organizationId: typedProfile.organization_id
        }

        const result = await scheduleServiceEnhanced.getUpcomingSchedules(
          daysAhead,
          filters.showAll || false,
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
    enabled: !!user && !authLoading && !!typedProfile && !profileLoading && !!typedProfile?.organization_id,
    staleTime: 0 // Immediate refetch on invalidation
  })
}