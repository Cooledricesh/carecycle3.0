'use client'

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'

type OptimisticMutationOptions<TData, TError, TVariables, TContext> = {
  mutationFn: (variables: TVariables) => Promise<TData>
  queryKey: string[]
  optimisticUpdate?: (oldData: any, variables: TVariables) => any
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void
  successMessage?: string
  errorMessage?: string
  rollbackOnError?: boolean
}

export function useOptimisticMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
  rollbackOnError = true,
}: OptimisticMutationOptions<TData, TError, TVariables, TContext>) {
  const queryClient = useQueryClient()

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    
    // Optimistically update the cache before the mutation
    onMutate: async (variables) => {
      if (!optimisticUpdate) return

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: any) => {
        return optimisticUpdate(old, variables)
      })

      // Return a context object with the snapshotted value
      return { previousData } as TContext
    },

    // If the mutation fails, use the context to rollback
    onError: (error, variables, context) => {
      console.error(`[useOptimisticMutation] Error:`, error)
      
      if (rollbackOnError && context && 'previousData' in context) {
        queryClient.setQueryData(queryKey, (context as any).previousData)
      }

      toast({
        title: '오류 발생',
        description: errorMessage || '작업을 완료하지 못했습니다. 다시 시도해주세요.',
        variant: 'destructive',
      })

      onError?.(error, variables, context)
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },

    onSuccess: (data, variables, context) => {
      if (successMessage) {
        toast({
          title: '성공',
          description: successMessage,
        })
      }

      onSuccess?.(data, variables, context)
    },
  } as UseMutationOptions<TData, TError, TVariables, TContext>)
}

// Specific optimistic mutation for patients
export function useOptimisticPatientMutation() {
  return {
    // Add patient optimistically
    useAddPatient: (mutationFn: (patient: any) => Promise<any>) => {
      return useOptimisticMutation({
        mutationFn,
        queryKey: ['patients'],
        optimisticUpdate: (oldData, newPatient) => {
          if (!oldData) return [newPatient]
          return [...oldData, { ...newPatient, id: `temp-${Date.now()}` }]
        },
        successMessage: '환자가 성공적으로 등록되었습니다.',
        errorMessage: '환자 등록 중 오류가 발생했습니다.',
      })
    },

    // Delete patient optimistically
    useDeletePatient: (mutationFn: (id: string) => Promise<void>) => {
      return useOptimisticMutation({
        mutationFn,
        queryKey: ['patients'],
        optimisticUpdate: (oldData, id: string) => {
          if (!oldData) return []
          return oldData.filter((patient: any) => patient.id !== id)
        },
        successMessage: '환자가 성공적으로 삭제되었습니다.',
        errorMessage: '환자 삭제 중 오류가 발생했습니다.',
      })
    },

    // Update patient optimistically
    useUpdatePatient: (mutationFn: (patient: any) => Promise<any>) => {
      return useOptimisticMutation({
        mutationFn,
        queryKey: ['patients'],
        optimisticUpdate: (oldData, updatedPatient: any) => {
          if (!oldData) return [updatedPatient]
          return oldData.map((patient: any) => 
            patient.id === updatedPatient.id ? updatedPatient : patient
          )
        },
        successMessage: '환자 정보가 업데이트되었습니다.',
        errorMessage: '환자 정보 업데이트 중 오류가 발생했습니다.',
      })
    },
  }
}

// Specific optimistic mutation for schedules
export function useOptimisticScheduleMutation() {
  return {
    // Add schedule optimistically
    useAddSchedule: (mutationFn: (schedule: any) => Promise<any>) => {
      return useOptimisticMutation({
        mutationFn,
        queryKey: ['schedules'],
        optimisticUpdate: (oldData, newSchedule) => {
          if (!oldData) return [newSchedule]
          return [...oldData, { ...newSchedule, id: `temp-${Date.now()}` }]
        },
        successMessage: '스케줄이 성공적으로 추가되었습니다.',
        errorMessage: '스케줄 추가 중 오류가 발생했습니다.',
      })
    },

    // Update schedule execution optimistically
    useUpdateExecution: (mutationFn: (execution: any) => Promise<any>) => {
      return useOptimisticMutation({
        mutationFn,
        queryKey: ['today-checklist'],
        optimisticUpdate: (oldData, updatedExecution: any) => {
          if (!oldData) return []
          return oldData.map((item: any) => 
            item.id === updatedExecution.id 
              ? { ...item, status: updatedExecution.status, executedAt: new Date().toISOString() }
              : item
          )
        },
        successMessage: '실행 상태가 업데이트되었습니다.',
        errorMessage: '상태 업데이트 중 오류가 발생했습니다.',
      })
    },
  }
}