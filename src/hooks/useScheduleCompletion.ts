'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/providers/auth-provider-simple'
import { scheduleService } from '@/services/scheduleService'
import type { ScheduleWithDetails } from '@/types/schedule'
import { format } from 'date-fns'

interface UseScheduleCompletionReturn {
  selectedSchedule: ScheduleWithDetails | null
  executionDate: string
  executionNotes: string
  isSubmitting: boolean
  isDialogOpen: boolean
  handleComplete: (schedule: ScheduleWithDetails) => void
  handleSubmit: () => Promise<void>
  reset: () => void
  setExecutionDate: (date: string) => void
  setExecutionNotes: (notes: string) => void
  setDialogOpen: (open: boolean) => void
}

export function useScheduleCompletion(): UseScheduleCompletionReturn {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithDetails | null>(null)
  const [executionDate, setExecutionDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [executionNotes, setExecutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleComplete = (schedule: ScheduleWithDetails) => {
    setSelectedSchedule(schedule)
    setExecutionDate(format(new Date(), 'yyyy-MM-dd'))
    setExecutionNotes('')
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedSchedule || !user) return

    setIsSubmitting(true)
    try {
      await scheduleService.markAsCompleted(selectedSchedule.id, {
        executedDate: executionDate,
        notes: executionNotes,
        executedBy: user.id
      })

      toast({
        title: "완료 처리 성공",
        description: `${selectedSchedule.patient?.name}님의 ${selectedSchedule.item?.name} 일정이 완료 처리되었습니다.`,
      })

      // Reset state and close dialog
      reset()
      
      // Invalidate all queries for immediate update
      await queryClient.invalidateQueries()
      
    } catch (error) {
      console.error('Failed to mark schedule as completed:', error)
      toast({
        title: "오류",
        description: "완료 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const reset = () => {
    setSelectedSchedule(null)
    setExecutionNotes('')
    setIsDialogOpen(false)
  }

  const setDialogOpen = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      reset()
    }
  }

  return {
    selectedSchedule,
    executionDate,
    executionNotes,
    isSubmitting,
    isDialogOpen,
    handleComplete,
    handleSubmit,
    reset,
    setExecutionDate,
    setExecutionNotes,
    setDialogOpen
  }
}