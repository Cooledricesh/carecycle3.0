'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventManager } from '@/lib/events/schedule-event-manager'

export function useScheduleRefetch() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = eventManager.subscribeToScheduleChanges(() => {
      queryClient.refetchQueries({
        queryKey: ['calendar-schedules'],
        type: 'active'
      })
      queryClient.refetchQueries({
        queryKey: ['schedules'],
        type: 'active'
      })
    })

    return unsubscribe
  }, [queryClient])
}