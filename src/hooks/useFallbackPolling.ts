'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventManager } from '@/lib/realtime/event-manager'
import { connectionManager } from '@/lib/realtime/connection-manager'

type PollingConfig = {
  queryKeys: string[][]
  intervalWhenDisconnected?: number  // Poll interval when real-time is disconnected
  intervalWhenConnected?: number     // Poll interval when real-time is connected (longer)
  enabled?: boolean
}

export function useFallbackPolling({
  queryKeys,
  intervalWhenDisconnected = 5000,   // 5 seconds when disconnected
  intervalWhenConnected = 30000,     // 30 seconds when connected (as backup)
  enabled = true
}: PollingConfig) {
  const queryClient = useQueryClient()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const startPolling = (interval: number) => {
      // Clear existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      console.log(`[useFallbackPolling] Starting polling with ${interval}ms interval`)

      // Set up new interval
      pollingIntervalRef.current = setInterval(() => {
        console.log('[useFallbackPolling] Polling data...')
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ 
            queryKey: key,
            refetchType: 'active' // Only refetch if the query is being used
          })
        })
      }, interval)
    }

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        console.log('[useFallbackPolling] Stopping polling')
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    // Handle connection state changes
    const handleConnectionChange = (event: { type: string }) => {
      const wasConnected = isConnectedRef.current
      const isNowConnected = event.type === 'connected'
      
      // Update connection state
      isConnectedRef.current = isNowConnected

      // Adjust polling based on connection state
      if (!wasConnected && isNowConnected) {
        // Just connected - switch to slower polling
        console.log('[useFallbackPolling] Real-time connected, switching to backup polling')
        startPolling(intervalWhenConnected)
      } else if (wasConnected && !isNowConnected) {
        // Just disconnected - switch to faster polling
        console.log('[useFallbackPolling] Real-time disconnected, switching to frequent polling')
        startPolling(intervalWhenDisconnected)
        
        // Immediately fetch data once
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      }
    }

    // Subscribe to connection events
    const unsubscribe = eventManager.subscribeToConnection(handleConnectionChange)

    // Start with appropriate interval based on current connection state
    const currentlyConnected = connectionManager.isConnected()
    isConnectedRef.current = currentlyConnected
    startPolling(currentlyConnected ? intervalWhenConnected : intervalWhenDisconnected)

    // Cleanup
    return () => {
      stopPolling()
      unsubscribe()
    }
  }, [queryKeys, intervalWhenDisconnected, intervalWhenConnected, enabled, queryClient])
}

// Pre-configured polling for common use cases
export function useDashboardPolling() {
  useFallbackPolling({
    queryKeys: [
      ['patients'],
      ['schedules'],
      ['today-checklist'],
      ['schedule-summary'],
      ['recent-activity']
    ],
    intervalWhenDisconnected: 5000,  // 5 seconds
    intervalWhenConnected: 60000,    // 1 minute
  })
}

export function usePatientsPolling() {
  useFallbackPolling({
    queryKeys: [
      ['patients']
    ],
    intervalWhenDisconnected: 3000,  // 3 seconds
    intervalWhenConnected: 30000,    // 30 seconds
  })
}

export function useSchedulesPolling() {
  useFallbackPolling({
    queryKeys: [
      ['schedules'],
      ['today-checklist'],
      ['schedule-executions']
    ],
    intervalWhenDisconnected: 4000,  // 4 seconds
    intervalWhenConnected: 45000,    // 45 seconds
  })
}