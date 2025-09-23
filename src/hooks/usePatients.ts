'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '@/services/patientService'
import type { Patient } from '@/types/patient'
import type { PatientCreateInput } from '@/schemas/patient'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuth } from '@/providers/auth-provider-simple'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useFilterContext } from '@/lib/filters/filter-context'
// Removed complex query keys - using simple invalidation

export function usePatients() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['patients', user?.id, profile?.role, profile?.care_type, filters.showAll],
    queryFn: async () => {
      try {
        const userContext = profile ? {
          role: profile.role,
          careType: profile.care_type,
          showAll: filters.showAll || false
        } : undefined

        return await patientService.getAll(supabase, userContext)
      } catch (error) {
        if (!loading) {
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
    enabled: true
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientCreateInput) => {
      return await patientService.create(input, supabase)
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '환자 등록 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSuccess: () => {
      // Invalidate ALL queries to ensure consistency
      queryClient.invalidateQueries()
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
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '환자 삭제 실패',
        description: message,
        variant: 'destructive'
      })
    },
    onSuccess: () => {
      // Invalidate ALL queries to ensure consistency
      queryClient.invalidateQueries()
      toast({
        title: '성공',
        description: '환자가 성공적으로 삭제되었습니다.'
      })
    }
  })

  const refetch = () => {
    // Invalidate all queries to ensure fresh data
    queryClient.invalidateQueries()
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
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['patients', id],
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
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => patientService.search(query, supabase),
    enabled: query.length >= 2, // Only check query length, not auth
    staleTime: 10 * 1000 // 10 seconds
  })
}