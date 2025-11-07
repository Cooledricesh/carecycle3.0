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
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'
// Removed complex query keys - using simple invalidation

export function usePatients() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['patients', profile?.organization_id, user?.id, profile?.role, profile?.care_type, filters.showAll],
    queryFn: async () => {
      try {
        if (!profile?.organization_id) {
          throw new Error('Organization ID not available')
        }

        const userContext = profile ? {
          role: profile.role,
          careType: profile.care_type,
          showAll: filters.showAll || false,
          userId: profile.id
        } : undefined

        return await patientService.getAll(profile.organization_id, supabase, userContext)
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
    enabled: !!profile?.organization_id
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientCreateInput) => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await patientService.create(input, profile.organization_id, supabase)
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
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return await patientService.delete(id, profile.organization_id, supabase)
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
  const supabase = createClient()

  return useQuery({
    queryKey: ['patients', profile?.organization_id, id],
    queryFn: async () => {
      try {
        if (!profile?.organization_id) {
          throw new Error('Organization ID not available')
        }
        const patient = await patientService.getById(id, profile.organization_id, supabase)
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
    enabled: !!id && !!profile?.organization_id,
    retry: 3, // Increased retries for production stability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })
}

export function useSearchPatients(query: string) {
  const { user, loading } = useAuth()
  const { data: profile } = useProfile()
  const supabase = createClient()

  return useQuery({
    queryKey: ['patients', 'search', profile?.organization_id, query],
    queryFn: () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return patientService.search(query, profile.organization_id, supabase)
    },
    enabled: query.length >= 2 && !!profile?.organization_id,
    staleTime: 10 * 1000 // 10 seconds
  })
}