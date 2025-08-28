'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { queryKeys } from '@/lib/query-keys'
import { useAuthContext } from '@/providers/auth-provider'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Schedule, Patient } from '@/types'
import { toCamelCase } from '@/lib/database-utils'

/**
 * Enhanced Real-time synchronization hook
 * Subscribes to database changes and directly updates the React Query cache
 * for an instantaneous UI update, bypassing refetch latency.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!initialized || !user) {
      return
    }

    const channel = supabase.channel(`realtime-sync:${user.id}`)

    // --- PATIENTS SUBSCRIPTION ---
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patients' },
      (payload) => {
        console.log('[Realtime] Patient change received:', payload)
        const newPatient = toCamelCase(payload.new) as Patient
        const oldPatientId = (payload.old as any)?.id

        // Update the main list of patients
        queryClient.setQueryData(
          queryKeys.patients.lists(),
          (oldData: Patient[] | undefined) => {
            if (!oldData) return []
            switch (payload.eventType) {
              case 'INSERT':
                return [newPatient, ...oldData]
              case 'UPDATE':
                return oldData.map((p) => (p.id === newPatient.id ? newPatient : p))
              case 'DELETE':
                return oldData.filter((p) => p.id !== oldPatientId)
              default:
                return oldData
            }
          }
        )
        // Invalidate details query if it exists
        if (newPatient.id || oldPatientId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.patients.detail(newPatient.id || oldPatientId) })
        }
      }
    )

    // --- SCHEDULES SUBSCRIPTION ---
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schedules' },
      (payload) => {
        console.log('[Realtime] Schedule change received:', payload)
        // Invalidate all schedule queries for simplicity and robustness
        // Direct cache manipulation is complex due to multiple views (today, upcoming, etc.)
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.executions.all })
      }
    )
    
    // --- EXECUTIONS SUBSCRIPTION ---
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schedule_executions' },
      (payload) => {
        console.log('[Realtime] Execution change received:', payload)
        // Invalidate all schedule and execution queries
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.executions.all })
      }
    )

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed!')
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error:', err)
      }
    })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        console.log('[Realtime] Unsubscribed.')
      }
    }
  }, [initialized, user, queryClient, supabase])
}

// Keep this hook for layout components
export function useGlobalRealtimeSync() {
  useRealtimeSync()
}