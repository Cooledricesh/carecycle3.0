'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { queryKeys } from '@/lib/query-keys'
import { useAuthContext } from '@/providers/auth-provider'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Real-time synchronization hook
 * Subscribes to database changes and automatically invalidates relevant queries
 * This ensures data stays in sync across all tabs and users
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  useEffect(() => {
    if (!initialized || !user) {
      console.log('[Realtime] Skipping - auth not ready')
      return
    }

    const setupRealtimeSubscription = async () => {
      try {
        // Clean up any existing channel
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }

        console.log('[Realtime] Setting up subscription for user:', user.id)

        // Create a single channel for all subscriptions
        const channel = supabase
          .channel(`realtime-sync-${user.id}`, {
            config: {
              presence: { key: user.id },
            },
          })

        // Subscribe to schedule changes
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedules'
          },
          (payload) => {
            console.log('[Realtime] Schedule change:', payload.eventType)
            
            // Invalidate all schedule-related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all })
            
            // If a specific patient's schedule changed
            if (payload.new && 'patient_id' in payload.new) {
              const patientId = payload.new.patient_id as string
              if (patientId) {
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.schedules.byPatient(patientId) 
                })
              }
            }
          }
        )

        // Subscribe to execution changes
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedule_executions'
          },
          (payload) => {
            console.log('[Realtime] Execution change:', payload.eventType)
            
            // Invalidate execution and schedule queries
            queryClient.invalidateQueries({ queryKey: queryKeys.executions.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all })
          }
        )

        // Subscribe to patient changes
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patients'
          },
          (payload) => {
            console.log('[Realtime] Patient change:', payload.eventType)
            
            // Invalidate patient queries
            queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })
            
            // If a specific patient changed
            if (payload.new && 'id' in payload.new) {
              const patientId = payload.new.id as string
              if (patientId) {
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.patients.detail(patientId) 
                })
              }
            }
          }
        )

        // Subscribe with error handling
        const subscription = channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Successfully subscribed')
            retryCountRef.current = 0 // Reset retry count on success
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Subscription status: ${status}`, err)
            
            // Implement exponential backoff retry
            if (retryCountRef.current < 5) {
              const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
              console.log(`[Realtime] Will retry in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/5)`)
              
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
              }
              
              retryTimeoutRef.current = setTimeout(() => {
                retryCountRef.current++
                setupRealtimeSubscription()
              }, retryDelay)
            } else {
              console.error('[Realtime] Max retries reached, giving up')
            }
          } else if (status === 'CLOSED') {
            console.log('[Realtime] Channel closed')
          }
        })

        channelRef.current = channel
      } catch (error) {
        console.error('[Realtime] Setup error:', error)
      }
    }

    setupRealtimeSubscription()

    // Cleanup function
    return () => {
      console.log('[Realtime] Cleaning up subscription')
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [initialized, user, queryClient, supabase])
}

/**
 * Hook to use in layout components to enable real-time sync
 * Should be called at the highest level of authenticated pages
 */
export function useGlobalRealtimeSync() {
  useRealtimeSync()
}