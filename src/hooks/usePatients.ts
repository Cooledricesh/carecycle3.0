'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '@/services/patientService'
import type { Patient } from '@/types/patient'
import type { PatientCreateInput } from '@/schemas/patient'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'

export function usePatients() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      try {
        return await patientService.getAll()
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
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientCreateInput) => {
      return await patientService.create(input)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({
        title: '성공',
        description: '환자가 성공적으로 등록되었습니다.'
      })
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '환자 등록 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] })
  }

  return {
    patients: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    createPatient: createMutation.mutate,
    isCreating: createMutation.isPending
  }
}

export function usePatient(id: string) {
  const { toast } = useToast()
  
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      try {
        const patient = await patientService.getById(id)
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
    enabled: !!id,
    retry: 1
  })
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => patientService.search(query),
    enabled: query.length >= 2,
    staleTime: 10 * 1000 // 10 seconds
  })
}