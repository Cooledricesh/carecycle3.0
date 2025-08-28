'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventManager, type DatabaseEvent, type ConnectionEvent } from '@/lib/realtime/event-manager'
import { connectionManager } from '@/lib/realtime/connection-manager'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { toast } from '@/hooks/use-toast'

export function useRealtimeEvents() {
  const queryClient = useQueryClient()

  // Handle database events
  const handleDatabaseEvent = useCallback((event: DatabaseEvent) => {
    console.log(`[useRealtimeEvents] Database event:`, event)

    switch (event.table) {
      case 'patients':
        // Invalidate all patient-related queries
        queryClient.invalidateQueries({ queryKey: ['patients'] })
        
        // Show toast for user feedback
        if (event.type === 'INSERT') {
          toast({
            title: '새 환자 추가됨',
            description: '환자 목록이 업데이트되었습니다.',
          })
        } else if (event.type === 'DELETE') {
          toast({
            title: '환자 삭제됨',
            description: '환자 목록이 업데이트되었습니다.',
          })
        }
        break

      case 'schedules':
        // Invalidate schedule-related queries
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
        queryClient.invalidateQueries({ queryKey: ['schedule-summary'] })
        queryClient.invalidateQueries({ queryKey: ['today-checklist'] })
        
        // Show toast for user feedback
        if (event.type === 'INSERT') {
          toast({
            title: '새 스케줄 추가됨',
            description: '스케줄이 업데이트되었습니다.',
          })
        } else if (event.type === 'UPDATE') {
          toast({
            title: '스케줄 수정됨',
            description: '스케줄이 업데이트되었습니다.',
          })
        }
        break

      case 'schedule_executions':
        // Invalidate execution-related queries
        queryClient.invalidateQueries({ queryKey: ['schedule-executions'] })
        queryClient.invalidateQueries({ queryKey: ['today-checklist'] })
        queryClient.invalidateQueries({ queryKey: ['recent-activity'] })
        break

      case 'items':
        // Invalidate item-related queries
        queryClient.invalidateQueries({ queryKey: ['items'] })
        break

      default:
        console.warn(`[useRealtimeEvents] Unhandled table: ${event.table}`)
    }
  }, [queryClient])

  // Handle connection events
  const handleConnectionEvent = useCallback((event: ConnectionEvent) => {
    console.log(`[useRealtimeEvents] Connection event:`, event)

    switch (event.type) {
      case 'connected':
        toast({
          title: '실시간 연결됨',
          description: '실시간 업데이트가 활성화되었습니다.',
          duration: 2000,
        })
        break

      case 'disconnected':
        toast({
          title: '연결 끊김',
          description: '실시간 업데이트가 중단되었습니다.',
          variant: 'destructive',
        })
        break

      case 'reconnecting':
        toast({
          title: '재연결 중...',
          description: event.message || '실시간 연결을 복구하고 있습니다.',
        })
        break

      case 'error':
        toast({
          title: '연결 오류',
          description: event.message || '실시간 연결에 문제가 발생했습니다.',
          variant: 'destructive',
        })
        break
    }
  }, [])

  useEffect(() => {
    // Initialize connection manager if not already initialized
    const supabase = getSupabaseClient()
    connectionManager.initialize(supabase)

    // Subscribe to events
    const unsubscribeDatabase = eventManager.subscribeToTable('patients', handleDatabaseEvent)
    const unsubscribeSchedules = eventManager.subscribeToTable('schedules', handleDatabaseEvent)
    const unsubscribeExecutions = eventManager.subscribeToTable('schedule_executions', handleDatabaseEvent)
    const unsubscribeItems = eventManager.subscribeToTable('items', handleDatabaseEvent)
    const unsubscribeConnection = eventManager.subscribeToConnection(handleConnectionEvent)

    // Cleanup function
    return () => {
      unsubscribeDatabase()
      unsubscribeSchedules()
      unsubscribeExecutions()
      unsubscribeItems()
      unsubscribeConnection()
    }
  }, [handleDatabaseEvent, handleConnectionEvent])

  // Return connection status for components that need it
  return {
    isConnected: connectionManager.isConnected(),
  }
}