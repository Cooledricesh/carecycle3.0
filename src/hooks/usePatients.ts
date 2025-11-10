'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '@/services/patientService'
import type { Patient } from '@/types/patient'
import type { PatientCreateInput } from '@/schemas/patient'
import { useToast } from '@/hooks/use-toast'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { useAuth } from '@/providers/auth-provider-simple'
import { createClient } from '@/lib/supabase/client'
import { useProfile, Profile } from '@/hooks/useProfile'
import { useFilterContext } from '@/lib/filters/filter-context'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'
// Removed complex query keys - using simple invalidation

export function usePatients() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const { filters } = useFilterContext()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['patients', typedProfile?.organization_id, user?.id, typedProfile?.role, typedProfile?.department_id, filters.showAll],
    queryFn: async () => {
      try {
        if (!typedProfile?.organization_id) {
          throw new Error('Organization ID not available')
        }

        const userContext = typedProfile ? {
          role: typedProfile.role,
          departmentId: typedProfile.department_id,
          showAll: filters.showAll || false,
          userId: typedProfile.id
        } : undefined

        return await patientService.getAll(typedProfile.organization_id, supabase, userContext)
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
    enabled: !!typedProfile?.organization_id
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientCreateInput) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await patientService.create(input, typedProfile.organization_id, supabase)
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
      scheduleServiceEnhanced.clearCache()
      eventManager.emitPatientChange()
      queryClient.invalidateQueries()
      toast({
        title: '성공',
        description: '환자가 성공적으로 등록되었습니다.'
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await patientService.delete(id, typedProfile.organization_id, supabase)
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
      scheduleServiceEnhanced.clearCache()
      eventManager.emitPatientChange()
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
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['patients', typedProfile?.organization_id, id],
    queryFn: async () => {
      try {
        if (!typedProfile?.organization_id) {
          throw new Error('Organization ID not available')
        }
        const patient = await patientService.getById(id, typedProfile.organization_id, supabase)
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
    enabled: !!id && !!typedProfile?.organization_id,
    retry: 3, // Increased retries for production stability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })
}

export function useSearchPatients(query: string) {
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['patients', 'search', typedProfile?.organization_id, query],
    queryFn: () => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return patientService.search(query, typedProfile.organization_id, supabase)
    },
    enabled: query.length >= 2 && !!typedProfile?.organization_id,
    staleTime: 10 * 1000 // 10 seconds
  })
}