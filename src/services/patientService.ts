'use client'

import { createClient, type SupabaseClient } from '@/lib/supabase/client'
import { executeQueryWithSignal } from '@/lib/supabase/query-helpers'
import { 
  PatientCreateSchema, 
  PatientUpdateSchema,
  type PatientCreateInput,
  type PatientUpdateInput 
} from '@/schemas/patient'
import type { Patient } from '@/types/patient'
import { toCamelCase, toSnakeCase } from '@/lib/database-utils'
import { patientValidationService } from '@/lib/patient-management/patient-validation-service'
import { PatientRestoreManager } from '@/lib/patient-management/patient-restore-manager'

export const patientService = {
  async create(input: PatientCreateInput, organizationId: string, supabase?: SupabaseClient): Promise<Patient> {
    const client = supabase || createClient()
    try {
      console.log('[patientService.create] Input:', input, 'OrganizationId:', organizationId)
      const validated = PatientCreateSchema.parse(input)
      console.log('[patientService.create] Validated:', validated)
      
      // Check auth session before proceeding
      const { data: { session }, error: sessionError } = await client.auth.getSession()
      if (sessionError || !session) {
        console.error('[patientService.create] Auth session error:', sessionError)
        console.log('[patientService.create] Session status:', session ? 'exists' : 'missing')
        
        // Try to refresh session
        const { error: refreshError } = await client.auth.refreshSession()
        if (refreshError) {
          throw new Error('인증 세션이 만료되었습니다. 다시 로그인해주세요.')
        }
      }
      
      // Simple insert without encryption
      const insertData = {
        name: validated.name,
        patient_number: validated.patientNumber,
        department: validated.department || null,
        care_type: validated.careType || null,
        doctor_id: validated.doctorId || null,
        is_active: validated.isActive ?? true,
        metadata: validated.metadata || {},
        organization_id: organizationId
      }
      
      console.log('[patientService.create] Insert data:', insertData)
      console.log('[patientService.create] Auth user ID:', session?.user?.id)
      
      const { data, error } = await (client as any)
          .from('patients')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        // Enhanced error logging
        console.error('[patientService.create] Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          // Use replacer function to handle circular references
          fullError: JSON.stringify(error, (key, value) => {
            if (key === 'context' || key === 'originalError') return '[Circular]'
            return value
          }, 2)
        })
        
        // If RLS policy error, try API route as fallback
        if (error.code === '42501') {
          console.log('[patientService.create] RLS policy error detected, using API route fallback')
          
          try {
            const response = await fetch('/api/patients', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: validated.name,
                patientNumber: validated.patientNumber,
                department: validated.department,
                careType: validated.careType,
                doctorId: validated.doctorId,
                isActive: validated.isActive,
                metadata: validated.metadata
              })
            })
            
            const responseData = await response.json()
            
            if (!response.ok) {
              console.error('[patientService.create] API route failed:', responseData)
              throw new Error(responseData.error || '환자 등록에 실패했습니다.')
            }
            
            console.log('[patientService.create] Successfully created via API route:', responseData)
            return responseData as Patient
            
          } catch (apiError) {
            console.error('[patientService.create] API route fallback failed:', apiError)
            throw new Error('권한이 없습니다. 사용자 승인 상태를 확인해주세요.')
          }
        }
        
        // Handle other error types
        if (error.code === '23505') {
          throw new Error('이미 등록된 환자번호입니다.')
        } else if (error.message?.includes('JWT') || error.message?.includes('token')) {
          throw new Error('인증 토큰이 만료되었습니다. 다시 로그인해주세요.')
        } else if (error.code === 'PGRST301') {
          throw new Error('인증이 필요합니다. 다시 로그인해주세요.')
        } else {
          throw new Error(`환자 등록 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`)
        }
      }
      
      console.log('[patientService.create] Response data:', data)
      return toCamelCase(data) as Patient
    } catch (error) {
      console.error('[patientService.create] Caught error:', {
        isError: error instanceof Error,
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 등록에 실패했습니다')
    }
  },

  async getAll(organizationId: string, supabase?: SupabaseClient, userContext?: { role?: string; careType?: string | null; showAll?: boolean; userId?: string }): Promise<Patient[]> {
    const client = supabase || createClient()

    // Helper function to execute query with retry on auth failure
    const executeQuery = async (retryCount = 0): Promise<Patient[]> => {
      try {
        console.log('[patientService.getAll] Fetching patients with context:', userContext)

        let query = client
          .from('patients')
          .select(`
            *,
            assigned_doctor_name,
            doctor:profiles!doctor_id(id, name)
          `)
          .eq('is_active', true)
          .eq('organization_id', organizationId)

        // Apply role-based filtering for nurse and doctor
        if (userContext) {
          // Only apply filters when showAll is false (or undefined)
          if (!userContext.showAll) {
            if (userContext.role === 'doctor' && userContext.userId) {
              // Doctor filter: filter by doctor_id using current user's ID
              console.log('[patientService.getAll] Doctor filtering by doctor_id:', userContext.userId)
              query = query.eq('doctor_id', userContext.userId)
            } else if (userContext.role === 'nurse' && userContext.careType) {
              console.log('[patientService.getAll] Nurse filtering by care_type:', userContext.careType)
              query = query.eq('care_type', userContext.careType)
            }
          } else {
            console.log('[patientService.getAll] Showing all patients (showAll: true)')
          }
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('[patientService.getAll] Error:', error)
          
          // If auth error and first attempt, try refreshing session
          if ((error.message?.includes('JWT') || error.message?.includes('token') || error.code === 'PGRST301') && retryCount === 0) {
            console.log('[patientService.getAll] Auth error detected, refreshing session...')
            const { error: refreshError } = await client.auth.refreshSession()
            if (!refreshError) {
              // Retry after successful refresh
              return executeQuery(retryCount + 1)
            }
          }
          
          throw error
        }
        
        const patients = (data || []).map(item => {
          const camelCaseItem = toCamelCase(item) as any
          // Extract doctor information from the joined data
          // Use registered doctor name first, then fall back to assigned_doctor_name for pending doctors
          const patient: Patient = {
            ...camelCaseItem,
            doctorName: camelCaseItem.doctor?.name || camelCaseItem.assignedDoctorName || null,
            // Remove the nested doctor object to keep the interface clean
            doctor: undefined
          }
          return patient
        })
        console.log(`[patientService.getAll] Fetched ${patients.length} patients`)
        return patients
      } catch (error) {
        console.error('Error fetching patients:', error)
        throw error
      }
    }
    
    return executeQuery()
  },

  async getById(id: string, organizationId: string, supabase?: SupabaseClient): Promise<Patient | null> {
    const client = supabase || createClient()
    try {
      const { data, error } = await (client as any)
          .from('patients')
        .select(`
          *,
          assigned_doctor_name,
          doctor:profiles!doctor_id(id, name)
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }

      const camelCaseItem = toCamelCase(data) as any
      // Use registered doctor name first, then fall back to assigned_doctor_name for pending doctors
      const patient: Patient = {
        ...camelCaseItem,
        doctorName: camelCaseItem.doctor?.name || camelCaseItem.assignedDoctorName || null,
        doctor: undefined
      }
      return patient
    } catch (error) {
      console.error('Error fetching patient:', error)
      throw new Error('환자 정보 조회에 실패했습니다')
    }
  },

  async getByPatientNumber(patientNumber: string, organizationId: string, supabase?: SupabaseClient): Promise<Patient | null> {
    const client = supabase || createClient()
    try {
      const { data, error } = await (client as any)
          .from('patients')
        .select('*')
        .eq('patient_number', patientNumber)
        .eq('is_active', true)
        .eq('organization_id', organizationId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      return toCamelCase(data) as Patient
    } catch (error) {
      console.error('Error fetching patient by number:', error)
      return null
    }
  },

  async update(
    id: string,
    input: PatientUpdateInput,
    organizationId: string,
    options?: SupabaseClient | {
      supabase?: SupabaseClient
      signal?: AbortSignal
    }
  ): Promise<Patient> {
    // Type guard to check if the third argument is a SupabaseClient
    // Check for the 'from' method which is a key characteristic of SupabaseClient
    const isSupabaseClient = (arg: any): arg is SupabaseClient => {
      return arg && typeof arg === 'object' && typeof arg.from === 'function'
    }
    
    // Correctly determine client and signal based on argument type
    let client: SupabaseClient
    let signal: AbortSignal | undefined
    
    if (isSupabaseClient(options)) {
      // Old signature: third param is a SupabaseClient
      client = options
      signal = undefined
    } else if (options) {
      // New signature: third param is an options object
      client = options.supabase || createClient()
      signal = options.signal
    } else {
      // No third param provided
      client = createClient()
      signal = undefined
    }
    
    try {
      // Check if request was aborted before starting
      if (signal?.aborted) {
        const abortError = new Error('Request was aborted')
        abortError.name = 'AbortError'
        throw abortError
      }
      
      const validated = PatientUpdateSchema.parse(input)
      const snakeData = toSnakeCase(validated)

      // Build the query with native AbortSignal support
      const baseQuery = (client as any)
        .from('patients')
        .update(snakeData)
        .eq('id', id)
        .eq('organization_id', organizationId)

      // Execute query with AbortSignal support using type-safe helper
      const { data, error } = await executeQueryWithSignal<Patient>(
        baseQuery,
        signal,
        { select: true, single: true }
      )

      if (error) {
        // Check if this was an abort error
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          const abortError = new Error('Request was aborted')
          abortError.name = 'AbortError'
          throw abortError
        }

        // Use API route fallback for any RLS-related errors
        // Common error codes: 42501 (insufficient_privilege), 42P01 (undefined_table), 42703 (undefined_column), 42P17 (check_violation)
        const rlsErrorCodes = ['42501', '42P01', '42703', '42P17', '23503']
        const shouldUseFallback = rlsErrorCodes.includes(error.code) || error.message?.includes('violates')

        if (shouldUseFallback) {
          console.log('[patientService.update] RLS error detected, using API route fallback. Error code:', error.code)

          try {
            const response = await fetch(`/api/patients/${id}/update`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(validated),
              credentials: 'include', // Include cookies for authentication
              signal
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || '환자 정보 수정에 실패했습니다')
            }

            const responseData = await response.json()
            console.log('[patientService.update] Successfully updated via API route')
            return toCamelCase(responseData) as Patient

          } catch (apiError) {
            // Re-throw abort errors as-is
            if (apiError instanceof Error && apiError.name === 'AbortError') {
              throw apiError
            }
            console.error('[patientService.update] API route fallback failed:', apiError)
            throw apiError instanceof Error ? apiError : new Error('환자 정보 수정에 실패했습니다')
          }
        }

        throw error
      }

      if (!data) {
        throw new Error('환자 정보 수정에 실패했습니다: 데이터가 없습니다')
      }

      return toCamelCase(data) as Patient
    } catch (error) {
      // Check if this was an abort
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request was aborted')) {
        throw error // Re-throw abort errors as-is
      }

      // Properly log error details for debugging
      console.error('Error updating patient:', {
        isError: error instanceof Error,
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        // For Supabase errors, include additional details
        ...(error && typeof error === 'object' && 'code' in error ? {
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint
        } : {})
      })

      // Re-throw the original error with its message if it's an Error instance
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 정보 수정에 실패했습니다')
    }
  },

  async delete(id: string, organizationId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase || createClient()
    try {
      console.log('[patientService.delete] Attempting to delete patient with id:', id)

      // First, check if the patient exists
      const { data: existingPatient, error: fetchError } = await (client as any)
          .from('patients')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single()
      
      if (fetchError) {
        console.error('[patientService.delete] Error fetching patient:', fetchError)
        if (fetchError.code === 'PGRST116') {
          throw new Error('환자를 찾을 수 없습니다')
        }
        throw fetchError
      }
      
      console.log('[patientService.delete] Found patient:', existingPatient)
      
      // Perform the soft delete on the patient
      // The database trigger will automatically cascade delete all related schedules
      const { error } = await (client as any)
          .from('patients')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('organization_id', organizationId)
      
      if (error) {
        console.error('[patientService.delete] Direct update failed:', error)
        console.error('[patientService.delete] Error code:', error.code)
        console.error('[patientService.delete] Error message:', error.message)
        console.error('[patientService.delete] Error details:', error.details)
        console.error('[patientService.delete] Error hint:', error.hint)
        
        // If RLS policy error (42501), use API route as fallback
        if (error.code === '42501') {
          console.log('[patientService.delete] RLS policy error, using API route fallback')
          
          const response = await fetch(`/api/patients/${id}/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('[patientService.delete] API route failed:', errorData)
            throw new Error(errorData.error || '환자 삭제에 실패했습니다')
          }
          
          console.log('[patientService.delete] Successfully deleted via API route')
          return
        }
        
        // For other errors, throw them
        throw error
      }
      
      console.log('[patientService.delete] Successfully deleted patient (schedules cascade deleted by trigger)')
    } catch (error) {
      console.error('[patientService.delete] Full error object:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 삭제에 실패했습니다')
    }
  },

  async search(query: string, organizationId: string, supabase?: SupabaseClient): Promise<Patient[]> {
    const client = supabase || createClient()
    try {
      // Validate minimum query length to prevent expensive searches
      if (query.trim().length < 2) {
        return []
      }

      // Sanitize query input
      const sanitizedQuery = query.replace(/[%_]/g, '\\$&')

      const { data, error } = await (client as any)
          .from('patients')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', organizationId)
        .or(`name.ilike.%${sanitizedQuery}%,patient_number.ilike.%${sanitizedQuery}%`)
        .limit(20)
      
      if (error) throw error
      return (data || []).map((item: any) => toCamelCase(item) as Patient)
    } catch (error) {
      console.error('Error searching patients:', error)
      throw new Error('환자 검색에 실패했습니다')
    }
  },

  async checkForRestoration(patientNumber: string, supabase?: SupabaseClient): Promise<{
    hasConflict: boolean
    validationResult?: any
    inactivePatient?: any
  }> {
    try {
      console.log('[patientService.checkForRestoration] Checking for restoration options:', patientNumber)
      
      const validationResult = await patientValidationService.validatePatientNumber(
        patientNumber,
        {
          checkFormat: true,
          checkDuplicates: true,
          allowRestoration: true,
          suggestAlternatives: false
        }
      )

      if (validationResult.isValid) {
        return { hasConflict: false }
      }

      // If there's a conflict that allows restoration, get inactive patient details
      let inactivePatient = null
      if (validationResult.conflictDetails?.canRestore || validationResult.conflictDetails?.canCreateNew) {
        try {
          const client = supabase || createClient()
          const restoreManager = new PatientRestoreManager(client)
          inactivePatient = await restoreManager.checkForInactivePatient(patientNumber)
        } catch (error) {
          console.warn('[patientService.checkForRestoration] Could not fetch inactive patient:', error)
        }
      }

      return {
        hasConflict: true,
        validationResult,
        inactivePatient
      }
    } catch (error) {
      console.error('[patientService.checkForRestoration] Error:', error)
      throw new Error('환자 복원 확인 중 오류가 발생했습니다')
    }
  },

  async restorePatient(patientId: string, options?: any, supabase?: SupabaseClient): Promise<Patient> {
    try {
      console.log('[patientService.restorePatient] Restoring patient:', patientId, options)
      
      const client = supabase || createClient()
      const restoreManager = new PatientRestoreManager(client)
      
      return await restoreManager.restorePatient(patientId, options)
    } catch (error) {
      console.error('[patientService.restorePatient] Error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 복원에 실패했습니다')
    }
  },

  async createWithArchive(patientNumber: string, options: any, supabase?: SupabaseClient): Promise<Patient> {
    try {
      console.log('[patientService.createWithArchive] Creating with archive:', patientNumber, options)
      
      const client = supabase || createClient()
      const restoreManager = new PatientRestoreManager(client)
      
      return await restoreManager.createWithArchive(patientNumber, options)
    } catch (error) {
      console.error('[patientService.createWithArchive] Error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 생성 중 오류가 발생했습니다')
    }
  }
}