'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useAuthContext } from '@/providers/auth-provider'

/**
 * Fallback synchronization using polling
 * Used when real-time subscriptions are not available
 * Refreshes key queries periodically to keep data in sync
 */
export function useFallbackSync(enabled: boolean = false) {
  const queryClient = useQueryClient()
  const { user, initialized } = useAuthContext()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled || !initialized || !user) {
      return
    }

    console.log('[FallbackSync] Starting polling sync')

    // Set up polling interval (every 10 seconds)
    intervalRef.current = setInterval(() => {
      // Refetch critical queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.schedules.today(),
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.schedules.lists(),
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.patients.lists(),
        exact: false 
      })
    }, 10000) // 10 seconds

    return () => {
      if (intervalRef.current) {
        console.log('[FallbackSync] Stopping polling sync')
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, initialized, user, queryClient])
}

/**
 * Smart sync hook that uses real-time when available, polling as fallback
 */
export function useSmartSync() {
  const fallbackEnabledRef = useRef(false)

  // Monitor real-time status and enable fallback if needed
  useEffect(() => {
    const checkRealtimeStatus = () => {
      // Check if we've had repeated real-time failures
      const realtimeErrors = sessionStorage.getItem('realtime-errors')
      const errorCount = realtimeErrors ? parseInt(realtimeErrors, 10) : 0
      
      // Enable fallback if we've had more than 3 errors
      if (errorCount > 3 && !fallbackEnabledRef.current) {
        console.log('[SmartSync] Enabling fallback sync due to real-time errors')
        fallbackEnabledRef.current = true
      }
    }

    const interval = setInterval(checkRealtimeStatus, 5000)
    checkRealtimeStatus()

    return () => clearInterval(interval)
  }, [])

  useFallbackSync(fallbackEnabledRef.current)
}