'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patientRestoreManager, type InactivePatient, type RestorePatientOptions, type CreateWithArchiveOptions } from '@/lib/patient-management/patient-restore-manager'
import { patientValidationService, type ValidationResult, type ConflictDetails } from '@/lib/patient-management/patient-validation-service'
import { useToast } from './use-toast'

export interface RestorationState {
  isCheckingConflict: boolean
  isRestoring: boolean
  isCreatingWithArchive: boolean
  conflictDetails: ConflictDetails | null
  inactivePatient: InactivePatient | null
  validationResult: ValidationResult | null
}

export interface UsePatientRestorationResult {
  state: RestorationState
  checkForConflict: (patientNumber: string) => Promise<ValidationResult>
  restorePatient: (patientId: string, options?: RestorePatientOptions) => Promise<void>
  createWithArchive: (patientNumber: string, options: CreateWithArchiveOptions) => Promise<void>
  clearConflict: () => void
  hasConflict: boolean
  canRestore: boolean
  canCreateNew: boolean
}

export function usePatientRestoration(): UsePatientRestorationResult {
  const [state, setState] = useState<RestorationState>({
    isCheckingConflict: false,
    isRestoring: false,
    isCreatingWithArchive: false,
    conflictDetails: null,
    inactivePatient: null,
    validationResult: null
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const checkForConflict = useCallback(async (patientNumber: string): Promise<ValidationResult> => {
    setState(prev => ({ ...prev, isCheckingConflict: true }))

    try {
      console.log('[usePatientRestoration.checkForConflict] Checking conflict for:', patientNumber)

      const validationResult = await patientValidationService.validatePatientNumber(
        patientNumber,
        {
          checkFormat: true,
          checkDuplicates: true,
          allowRestoration: true,
          suggestAlternatives: true
        }
      )

      console.log('[usePatientRestoration.checkForConflict] Validation result:', validationResult)

      // If there's a conflict, get the inactive patient details
      let inactivePatient: InactivePatient | null = null
      if (!validationResult.isValid && validationResult.conflictDetails?.canRestore) {
        try {
          inactivePatient = await patientRestoreManager.checkForInactivePatient(patientNumber)
        } catch (error) {
          console.warn('[usePatientRestoration.checkForConflict] Could not fetch inactive patient details:', error)
        }
      }

      setState(prev => ({
        ...prev,
        validationResult,
        conflictDetails: validationResult.conflictDetails || null,
        inactivePatient,
        isCheckingConflict: false
      }))

      return validationResult
    } catch (error) {
      console.error('[usePatientRestoration.checkForConflict] Error:', error)
      
      const errorResult: ValidationResult = {
        isValid: false,
        conflict: 'none',
        conflictDetails: {
          type: 'none',
          message: error instanceof Error ? error.message : '환자번호 검증 중 오류가 발생했습니다',
          canRestore: false,
          canCreateNew: false
        }
      }

      setState(prev => ({
        ...prev,
        validationResult: errorResult,
        conflictDetails: errorResult.conflictDetails || null,
        inactivePatient: null,
        isCheckingConflict: false
      }))

      return errorResult
    }
  }, [])

  const restorePatientMutation = useMutation({
    mutationFn: async ({ patientId, options }: { patientId: string; options?: RestorePatientOptions }) => {
      console.log('[usePatientRestoration.restorePatient] Restoring:', patientId, options)
      return await patientRestoreManager.restorePatient(patientId, options)
    },
    onMutate: () => {
      setState(prev => ({ ...prev, isRestoring: true }))
    },
    onSuccess: (restoredPatient) => {
      console.log('[usePatientRestoration.restorePatient] Successfully restored:', restoredPatient)
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient', restoredPatient.id] })
      
      // Clear conflict state
      setState(prev => ({
        ...prev,
        isRestoring: false,
        conflictDetails: null,
        inactivePatient: null,
        validationResult: null
      }))

      toast({
        title: '환자 복원 완료',
        description: `${restoredPatient.name} 환자가 성공적으로 복원되었습니다.`,
        variant: 'default'
      })
    },
    onError: (error) => {
      console.error('[usePatientRestoration.restorePatient] Error:', error)
      
      setState(prev => ({ ...prev, isRestoring: false }))
      
      toast({
        title: '환자 복원 실패',
        description: error instanceof Error ? error.message : '환자 복원 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    }
  })

  const createWithArchiveMutation = useMutation({
    mutationFn: async ({ patientNumber, options }: { patientNumber: string; options: CreateWithArchiveOptions }) => {
      console.log('[usePatientRestoration.createWithArchive] Creating with archive:', patientNumber, options)
      return await patientRestoreManager.createWithArchive(patientNumber, options)
    },
    onMutate: () => {
      setState(prev => ({ ...prev, isCreatingWithArchive: true }))
    },
    onSuccess: (newPatient) => {
      console.log('[usePatientRestoration.createWithArchive] Successfully created:', newPatient)
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient', newPatient.id] })
      
      // Clear conflict state
      setState(prev => ({
        ...prev,
        isCreatingWithArchive: false,
        conflictDetails: null,
        inactivePatient: null,
        validationResult: null
      }))

      toast({
        title: '환자 등록 완료',
        description: `${newPatient.name} 환자가 성공적으로 등록되었습니다. 기존 환자는 아카이빙되었습니다.`,
        variant: 'default'
      })
    },
    onError: (error) => {
      console.error('[usePatientRestoration.createWithArchive] Error:', error)
      
      setState(prev => ({ ...prev, isCreatingWithArchive: false }))
      
      toast({
        title: '환자 등록 실패',
        description: error instanceof Error ? error.message : '환자 등록 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    }
  })

  const restorePatient = useCallback(async (patientId: string, options?: RestorePatientOptions) => {
    await restorePatientMutation.mutateAsync({ patientId, options })
  }, [restorePatientMutation])

  const createWithArchive = useCallback(async (patientNumber: string, options: CreateWithArchiveOptions) => {
    await createWithArchiveMutation.mutateAsync({ patientNumber, options })
  }, [createWithArchiveMutation])

  const clearConflict = useCallback(() => {
    setState(prev => ({
      ...prev,
      conflictDetails: null,
      inactivePatient: null,
      validationResult: null
    }))
  }, [])

  const hasConflict = Boolean(state.conflictDetails && !state.validationResult?.isValid)
  const canRestore = Boolean(state.conflictDetails?.canRestore)
  const canCreateNew = Boolean(state.conflictDetails?.canCreateNew)

  return {
    state,
    checkForConflict,
    restorePatient,
    createWithArchive,
    clearConflict,
    hasConflict,
    canRestore,
    canCreateNew
  }
}