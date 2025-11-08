'use client'

import { createClient, type SupabaseClient } from '@/lib/supabase/client'
import { patientRestoreManager, type InactivePatient } from './patient-restore-manager'

export interface ValidationResult {
  isValid: boolean
  conflict?: ConflictType
  conflictDetails?: ConflictDetails
  suggestions?: string[]
}

export type ConflictType = 
  | 'active_patient_exists' 
  | 'inactive_patient_exists' 
  | 'archived_patient_exists'
  | 'multiple_conflicts'
  | 'none'

export interface ConflictDetails {
  type: ConflictType
  activePatient?: {
    id: string
    name: string
    patientNumber: string
    careType?: string | null
  }
  inactivePatient?: InactivePatient
  message: string
  canRestore: boolean
  canCreateNew: boolean
}

export interface PatientNumberValidationOptions {
  checkFormat?: boolean
  checkDuplicates?: boolean
  allowRestoration?: boolean
  suggestAlternatives?: boolean
}

export class PatientValidationService {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient()
  }

  async validatePatientNumber(
    patientNumber: string,
    options: PatientNumberValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      checkFormat = true,
      checkDuplicates = true,
      allowRestoration = true,
      suggestAlternatives = true
    } = options

    try {
      console.log('[PatientValidationService.validatePatientNumber] Validating:', patientNumber, options)

      // Step 1: Format validation
      if (checkFormat) {
        const formatResult = this.validatePatientNumberFormat(patientNumber)
        if (!formatResult.isValid) {
          return formatResult
        }
      }

      // Step 2: Duplicate check
      if (checkDuplicates) {
        const duplicateResult = await this.checkForDuplicates(patientNumber, allowRestoration)
        if (!duplicateResult.isValid) {
          // Add suggestions if requested
          if (suggestAlternatives && duplicateResult.conflictDetails?.type === 'active_patient_exists') {
            duplicateResult.suggestions = await this.generateAlternativeNumbers(patientNumber)
          }
          return duplicateResult
        }
      }

      console.log('[PatientValidationService.validatePatientNumber] Validation passed for:', patientNumber)
      return {
        isValid: true,
        conflict: 'none'
      }
    } catch (error) {
      console.error('[PatientValidationService.validatePatientNumber] Unexpected error:', error)
      return {
        isValid: false,
        conflict: 'none',
        conflictDetails: {
          type: 'none',
          message: '환자번호 검증 중 오류가 발생했습니다',
          canRestore: false,
          canCreateNew: false
        }
      }
    }
  }

  private validatePatientNumberFormat(patientNumber: string): ValidationResult {
    console.log('[PatientValidationService.validatePatientNumberFormat] Checking format for:', patientNumber)

    // Check length
    if (patientNumber.length < 1 || patientNumber.length > 50) {
      return {
        isValid: false,
        conflict: 'none',
        conflictDetails: {
          type: 'none',
          message: '환자번호는 1-50자 사이여야 합니다',
          canRestore: false,
          canCreateNew: false
        },
        suggestions: ['올바른 길이의 환자번호를 입력해주세요']
      }
    }

    // Check format (alphanumeric, uppercase)
    const formatRegex = /^[A-Z0-9]+$/
    if (!formatRegex.test(patientNumber)) {
      return {
        isValid: false,
        conflict: 'none',
        conflictDetails: {
          type: 'none',
          message: '환자번호는 영문 대문자와 숫자만 사용할 수 있습니다',
          canRestore: false,
          canCreateNew: false
        },
        suggestions: ['영문 대문자(A-Z)와 숫자(0-9)만 사용해주세요']
      }
    }

    // Additional business rules can be added here
    // For example: specific prefix requirements, checksum validation, etc.

    return { isValid: true, conflict: 'none' }
  }

  private async checkForDuplicates(
    patientNumber: string,
    allowRestoration: boolean
  ): Promise<ValidationResult> {
    try {
      console.log('[PatientValidationService.checkForDuplicates] Checking duplicates for:', patientNumber)

      // Check for active patient
      const { data: activePatient, error: activeError } = await (this.supabase as any)
          .from('patients')
        .select('id, name, patient_number, care_type')
        .eq('patient_number', patientNumber)
        .eq('is_active', true)
        .eq('archived', false)
        .single()

      if (activeError && activeError.code !== 'PGRST116') {
        console.error('[PatientValidationService.checkForDuplicates] Error checking active patient:', activeError)
        throw activeError
      }

      if (activePatient) {
        console.log('[PatientValidationService.checkForDuplicates] Found active patient conflict')
        return {
          isValid: false,
          conflict: 'active_patient_exists',
          conflictDetails: {
            type: 'active_patient_exists',
            activePatient: {
              id: activePatient.id,
              name: activePatient.name,
              patientNumber: activePatient.patient_number,
              careType: activePatient.care_type
            },
            message: '이미 등록된 환자번호입니다',
            canRestore: false,
            canCreateNew: false
          }
        }
      }

      // If restoration is allowed, check for inactive/archived patients
      if (allowRestoration) {
        const inactivePatient = await patientRestoreManager.checkForInactivePatient(patientNumber)
        
        if (inactivePatient) {
          console.log('[PatientValidationService.checkForDuplicates] Found inactive patient that can be restored')
          
          const conflictType: ConflictType = inactivePatient.archived 
            ? 'archived_patient_exists' 
            : 'inactive_patient_exists'

          return {
            isValid: false,
            conflict: conflictType,
            conflictDetails: {
              type: conflictType,
              inactivePatient,
              message: inactivePatient.archived 
                ? '동일한 환자번호로 아카이빙된 환자가 있습니다' 
                : '동일한 환자번호로 삭제된 환자가 있습니다',
              canRestore: true,
              canCreateNew: true
            }
          }
        }
      }

      console.log('[PatientValidationService.checkForDuplicates] No duplicates found')
      return { isValid: true, conflict: 'none' }
    } catch (error) {
      console.error('[PatientValidationService.checkForDuplicates] Unexpected error:', error)
      throw error
    }
  }

  private async generateAlternativeNumbers(baseNumber: string): Promise<string[]> {
    try {
      console.log('[PatientValidationService.generateAlternativeNumbers] Generating alternatives for:', baseNumber)

      const alternatives: string[] = []
      const maxAlternatives = 5

      // Strategy 1: Add numeric suffix
      for (let i = 1; i <= maxAlternatives; i++) {
        const candidate = `${baseNumber}${i.toString().padStart(2, '0')}`
        const isAvailable = await this.isPatientNumberAvailable(candidate)
        if (isAvailable) {
          alternatives.push(candidate)
        }
        if (alternatives.length >= maxAlternatives) break
      }

      // Strategy 2: If base has numbers, try incrementing them
      if (alternatives.length < maxAlternatives) {
        const numberMatch = baseNumber.match(/^([A-Z]+)(\d+)$/)
        if (numberMatch) {
          const [, prefix, numberPart] = numberMatch
          const baseNum = parseInt(numberPart, 10)
          
          for (let i = 1; i <= 10; i++) {
            const candidate = `${prefix}${(baseNum + i).toString().padStart(numberPart.length, '0')}`
            const isAvailable = await this.isPatientNumberAvailable(candidate)
            if (isAvailable) {
              alternatives.push(candidate)
            }
            if (alternatives.length >= maxAlternatives) break
          }
        }
      }

      console.log('[PatientValidationService.generateAlternativeNumbers] Generated alternatives:', alternatives)
      return alternatives
    } catch (error) {
      console.error('[PatientValidationService.generateAlternativeNumbers] Error generating alternatives:', error)
      return []
    }
  }

  private async isPatientNumberAvailable(patientNumber: string): Promise<boolean> {
    try {
      const { data, error } = await (this.supabase as any)
          .from('patients')
        .select('id')
        .eq('patient_number', patientNumber)
        .eq('is_active', true)
        .eq('archived', false)
        .limit(1)

      if (error) {
        console.error('[PatientValidationService.isPatientNumberAvailable] Error checking availability:', error)
        return false
      }

      return !data || data.length === 0
    } catch (error) {
      console.error('[PatientValidationService.isPatientNumberAvailable] Unexpected error:', error)
      return false
    }
  }

  async validateRestorationEligibility(patientId: string): Promise<{
    canRestore: boolean
    reason?: string
    restrictions?: string[]
  }> {
    try {
      console.log('[PatientValidationService.validateRestorationEligibility] Checking eligibility for:', patientId)

      const { data: patient, error } = await (this.supabase as any)
          .from('patients')
        .select(`
          id,
          patient_number,
          name,
          is_active,
          archived,
          archived_at,
          original_patient_number,
          created_at
        `)
        .eq('id', patientId)
        .single()

      if (error) {
        console.error('[PatientValidationService.validateRestorationEligibility] Error fetching patient:', error)
        return {
          canRestore: false,
          reason: '환자 정보를 찾을 수 없습니다'
        }
      }

      if (patient.is_active && !patient.archived) {
        return {
          canRestore: false,
          reason: '이미 활성화된 환자입니다'
        }
      }

      const restrictions: string[] = []

      // Check if original patient number is now taken by someone else
      if (patient.archived && patient.original_patient_number) {
        const { data: conflictingPatient, error: conflictError } = await (this.supabase as any)
          .from('patients')
          .select('id, name')
          .eq('patient_number', patient.original_patient_number)
          .eq('is_active', true)
          .eq('archived', false)
          .single()

        if (conflictError && conflictError.code !== 'PGRST116') {
          console.error('[PatientValidationService.validateRestorationEligibility] Error checking conflicts:', conflictError)
          restrictions.push('환자번호 충돌 확인 실패')
        } else if (conflictingPatient) {
          return {
            canRestore: false,
            reason: `원래 환자번호(${patient.original_patient_number})가 다른 환자에게 이미 할당되었습니다`,
            restrictions: [`현재 ${conflictingPatient.name} 환자가 해당 번호를 사용 중입니다`]
          }
        }
      }

      // Additional business rules can be added here
      // For example: time-based restrictions, permission checks, etc.

      console.log('[PatientValidationService.validateRestorationEligibility] Patient can be restored')
      return {
        canRestore: true,
        restrictions: restrictions.length > 0 ? restrictions : undefined
      }
    } catch (error) {
      console.error('[PatientValidationService.validateRestorationEligibility] Unexpected error:', error)
      return {
        canRestore: false,
        reason: '복원 가능성 검증 중 오류가 발생했습니다'
      }
    }
  }
}

export const patientValidationService = new PatientValidationService()