'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '@/services/patientService'
import type { Patient } from '@/types/patient'
import type { PatientCreateInput } from '@/schemas/patient'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuthContext } from '@/providers/auth-provider'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { queryKeys, getRelatedQueryKeys } from '@/lib/query-keys'

export function usePatients() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()

  const query = useQuery({
    queryKey: queryKeys.patients.lists(),
    queryFn: async () => {
      try {
        return await patientService.getAll(supabase)
      } catch (error) {
        // Don't show toast on first load to prevent noise during auth initialization
        if (initialized) {
          const message = mapErrorToUserMessage(error)
          toast({
            title: '오류',
            description: message,
            variant: 'destructive'
          })
        }
        throw error
      }
    },
    enabled: true, // CRITICAL FIX: Remove auth blocking to allow immediate data loading
    retry: 3, // Increased retries for production stability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 30 * 1000, // Reduced to 30 seconds for more frequent updates
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientCreateInput) => {
      return await patientService.create(input, supabase)
    },
    // Optimistic update
    onMutate: async (input: PatientCreateInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.patients.lists() })
      
      // Snapshot the previous value
      const previousPatients = queryClient.getQueryData<Patient[]>(queryKeys.patients.lists())
      
      // Optimistically update to the new value with a temporary ID
      const tempPatient = {
        id: `temp-${Date.now()}`,
        patientNumber: input.patientNumber,
        name: input.name,
        birthDate: (input as any).birthDate || null,
        gender: (input as any).gender || null,
        roomNumber: (input as any).roomNumber || null,
        bedNumber: (input as any).bedNumber || null,
        diagnosis: (input as any).diagnosis || null,
        careType: input.careType || null,
        notes: (input as any).notes || null,
        isActive: true,
        nurseId: user?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      queryClient.setQueryData<Patient[]>(queryKeys.patients.lists(), (old) => {
        if (!old) return [tempPatient as Patient]
        return [...old, tempPatient as Patient]
      })
      
      // Return a context object with the snapshotted value
      return { previousPatients }
    },
    onError: (error, input, context) => {
      // If the mutation fails, use the context to rollback
      if (context?.previousPatients) {
        queryClient.setQueryData(queryKeys.patients.lists(), context.previousPatients)
      }
      
      const message = mapErrorToUserMessage(error)
      toast({
        title: '환자 등록 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSettled: () => {
      // Always refetch after error or success
      const keysToInvalidate = getRelatedQueryKeys('patient.create')
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
    onSuccess: (data) => {
      toast({
        title: '성공',
        description: '환자가 성공적으로 등록되었습니다.'
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await patientService.delete(id, supabase)
    },
    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.patients.lists() })
      
      // Snapshot the previous value
      const previousPatients = queryClient.getQueryData<Patient[]>(queryKeys.patients.lists())
      
      // Optimistically update to the new value
      queryClient.setQueryData<Patient[]>(queryKeys.patients.lists(), (old) => {
        if (!old) return []
        return old.filter(patient => patient.id !== id)
      })
      
      // Return a context object with the snapshotted value
      return { previousPatients }
    },
    onError: (error, id, context) => {
      // If the mutation fails, use the context to rollback
      if (context?.previousPatients) {
        queryClient.setQueryData(queryKeys.patients.lists(), context.previousPatients)
      }
      
      const message = mapErrorToUserMessage(error)
      toast({
        title: '환자 삭제 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSettled: () => {
      // Always refetch after error or success
      const keysToInvalidate = getRelatedQueryKeys('patient.delete')
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
    onSuccess: () => {
      toast({
        title: '성공',
        description: '환자가 성공적으로 삭제되었습니다.'
      })
    }
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })
  }

  return {
    patients: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    createPatient: createMutation.mutate,
    isCreating: createMutation.isPending,
    deletePatient: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending
  }
}

export function usePatient(id: string) {
  const { toast } = useToast()
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.patients.detail(id),
    queryFn: async () => {
      try {
        const patient = await patientService.getById(id, supabase)
        if (!patient) {
          throw new Error('환자를 찾을 수 없습니다')
        }
        return patient
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
    enabled: !!id, // Only check if ID exists, not auth state
    retry: 3, // Increased retries for production stability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })
}

export function useSearchPatients(query: string) {
  const { user, initialized } = useAuthContext()
  const supabase = getSupabaseClient()
  
  return useQuery({
    queryKey: queryKeys.patients.search(query),
    queryFn: () => patientService.search(query, supabase),
    enabled: query.length >= 2, // Only check query length, not auth
    staleTime: 10 * 1000 // 10 seconds
  })
}