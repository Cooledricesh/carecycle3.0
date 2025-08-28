'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { 
  PatientCreateSchema, 
  PatientUpdateSchema,
  type PatientCreateInput,
  type PatientUpdateInput 
} from '@/schemas/patient'
import type { Patient } from '@/types/patient'
import { toCamelCase, toSnakeCase } from '@/lib/database-utils'
import type { Database } from '@/lib/database.types'

export const patientService = {
  async create(input: PatientCreateInput, supabase?: SupabaseClient<Database>): Promise<Patient> {
    const client = supabase || getSupabaseClient()
    try {
      console.log('[patientService.create] Input:', input)
      const validated = PatientCreateSchema.parse(input)
      console.log('[patientService.create] Validated:', validated)
      
      // Simple insert without encryption
      const insertData = {
        name: validated.name,
        patient_number: validated.patientNumber,
        department: validated.department || null,
        care_type: validated.careType || null,
        is_active: validated.isActive ?? true,
        metadata: validated.metadata || {}
      }
      
      console.log('[patientService.create] Insert data:', insertData)
      
      const { data, error } = await (client as any)
        .from('patients')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        console.error('[patientService.create] Supabase error:', error)
        throw error
      }
      
      console.log('[patientService.create] Response data:', data)
      return toCamelCase(data) as Patient
    } catch (error) {
      console.error('[patientService.create] Full error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 등록에 실패했습니다')
    }
  },

  async getAll(supabase?: SupabaseClient<Database>): Promise<Patient[]> {
    const client = supabase || getSupabaseClient()
    try {
      console.log('[patientService.getAll] Fetching patients...')
      const { data, error } = await client
        .from('patients')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('[patientService.getAll] Error:', error)
        throw error
      }
      
      const patients = (data || []).map(item => toCamelCase(item) as Patient)
      console.log(`[patientService.getAll] Fetched ${patients.length} patients`)
      return patients
    } catch (error) {
      console.error('Error fetching patients:', error)
      throw error // Throw error instead of returning empty array to trigger React Query retry
    }
  },

  async getById(id: string, supabase?: SupabaseClient<Database>): Promise<Patient | null> {
    const client = supabase || getSupabaseClient()
    try {
      const { data, error } = await client
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      return toCamelCase(data) as Patient
    } catch (error) {
      console.error('Error fetching patient:', error)
      throw new Error('환자 정보 조회에 실패했습니다')
    }
  },

  async getByPatientNumber(patientNumber: string, supabase?: SupabaseClient<Database>): Promise<Patient | null> {
    const client = supabase || getSupabaseClient()
    try {
      const { data, error } = await client
        .from('patients')
        .select('*')
        .eq('patient_number', patientNumber)
        .eq('is_active', true)
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

  async update(id: string, input: PatientUpdateInput, supabase?: SupabaseClient<Database>): Promise<Patient> {
    const client = supabase || getSupabaseClient()
    try {
      const validated = PatientUpdateSchema.parse(input)
      const snakeData = toSnakeCase(validated)
      
      const { data, error } = await (client as any)
        .from('patients')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return toCamelCase(data) as Patient
    } catch (error) {
      console.error('Error updating patient:', error)
      throw new Error('환자 정보 수정에 실패했습니다')
    }
  },

  async delete(id: string, supabase?: SupabaseClient<Database>): Promise<void> {
    const client = supabase || getSupabaseClient()
    try {
      console.log('[patientService.delete] Attempting to delete patient with id:', id)
      
      // First, check if the patient exists
      const { data: existingPatient, error: fetchError } = await client
        .from('patients')
        .select('*')
        .eq('id', id)
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

  async search(query: string, supabase?: SupabaseClient<Database>): Promise<Patient[]> {
    const client = supabase || getSupabaseClient()
    try {
      // Validate minimum query length to prevent expensive searches
      if (query.trim().length < 2) {
        return []
      }
      
      // Sanitize query input
      const sanitizedQuery = query.replace(/[%_]/g, '\\$&')
      
      const { data, error } = await client
        .from('patients')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${sanitizedQuery}%,patient_number.ilike.%${sanitizedQuery}%`)
        .limit(20)
      
      if (error) throw error
      return (data || []).map(item => toCamelCase(item) as Patient)
    } catch (error) {
      console.error('Error searching patients:', error)
      throw new Error('환자 검색에 실패했습니다')
    }
  }
}