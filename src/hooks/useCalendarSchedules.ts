'use client'

import { useQuery } from '@tanstack/react-query'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { useFilterContext } from '@/lib/filters/filter-context'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { ScheduleWithDetails } from '@/types/schedule'
import type { UserContext } from '@/services/filters'

interface CalendarSchedule extends ScheduleWithDetails {
  display_type?: 'scheduled' | 'completed'
  execution_id?: string
}

export function useCalendarSchedules(currentDate: Date) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  // Calculate date range for the month
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['calendar-schedules', monthStart, monthEnd, user?.id, profile?.role, profile?.care_type, filters],
    queryFn: async () => {
      try {
        if (!user || !profile) {
          return []
        }

        // Create user context for role-based filtering
        const userContext: UserContext = {
          userId: user.id,
          role: profile.role,
          careType: profile.care_type
        }

        // Use enhanced service with proper role-based filtering
        // The new RPC function returns both scheduled and completed items
        const result = await scheduleServiceEnhanced.getFilteredSchedules(
          {
            ...filters,
            dateRange: {
              start: monthStart,
              end: monthEnd
            }
          },
          userContext,
          supabase
        )

        // The RPC function now returns both scheduled and completed items with proper filtering
        const allSchedules = result.schedules || []

        // Transform schedules to include display_type for UI rendering
        return allSchedules.map(schedule => ({
          ...schedule,
          // Add display_type if not already present
          display_type: (schedule as any).display_type || 'scheduled'
        })) as CalendarSchedule[]

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
    enabled: !!user && !authLoading && !!profile && !profileLoading,
    staleTime: 0, // Immediate refetch on invalidation
    refetchInterval: 60000 // Refresh every minute
  })
}

// Hook for fetching execution history for a specific date
export function useScheduleExecutions(date: Date | null) {
  const { user } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedule-executions', date ? format(date, 'yyyy-MM-dd') : null, user?.id],
    queryFn: async () => {
      if (!date || !user) {
        return []
      }

      const dateString = format(date, 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('schedule_executions')
        .select(`
          *,
          schedules!inner (
            id,
            patient_id,
            item_id,
            interval_weeks,
            patients (
              id,
              name,
              care_type,
              doctor_id
            ),
            items (
              id,
              name,
              category
            )
          )
        `)
        .eq('executed_date', dateString)
        .eq('status', 'completed')
        .order('executed_time', { ascending: true })

      if (error) {
        throw error
      }

      // Transform to match ScheduleWithDetails format
      return (data || []).map(execution => ({
        id: execution.id,
        schedule_id: execution.schedule_id,
        patient_id: execution.schedules.patient_id,
        item_id: execution.schedules.item_id,
        patient_name: execution.schedules.patients?.name,
        item_name: execution.schedules.items?.name,
        item_category: execution.schedules.items?.category,
        interval_weeks: execution.schedules.interval_weeks,
        next_due_date: execution.executed_date,
        status: 'completed',
        display_type: 'completed' as const,
        execution_id: execution.id,
        executed_by: execution.executed_by,
        notes: execution.notes,
        patient: execution.schedules.patients,
        item: execution.schedules.items
      }))
    },
    enabled: !!date && !!user,
    staleTime: 30000
  })
}