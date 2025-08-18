'use client'

import { createClient } from '@/lib/supabase/client'
import { 
  PatientCreateSchema, 
  PatientUpdateSchema,
  type PatientCreateInput,
  type PatientUpdateInput 
} from '@/schemas/patient'
import type { Patient } from '@/types/patient'
import { snakeToCamel, camelToSnake } from '@/lib/database-utils'

const supabase = createClient()

export const patientService = {
  async create(input: PatientCreateInput): Promise<Patient> {
    try {
      const validated = PatientCreateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      const { data, error } = await supabase
        .from('patients')
        .insert({
          ...snakeData,
          name_encrypted: snakeData.name, // Will be encrypted by DB function
          patient_number_encrypted: snakeData.patient_number
        })
        .select()
        .single()
      
      if (error) throw error
      return snakeToCamel(data) as Patient
    } catch (error) {
      console.error('Error creating patient:', error)
      throw new Error('환자 등록에 실패했습니다')
    }
  },

  async getAll(): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return (data || []).map(item => snakeToCamel(item) as Patient)
    } catch (error) {
      console.error('Error fetching patients:', error)
      throw new Error('환자 목록 조회에 실패했습니다')
    }
  },

  async getById(id: string): Promise<Patient | null> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      return snakeToCamel(data) as Patient
    } catch (error) {
      console.error('Error fetching patient:', error)
      throw new Error('환자 정보 조회에 실패했습니다')
    }
  },

  async update(id: string, input: PatientUpdateInput): Promise<Patient> {
    try {
      const validated = PatientUpdateSchema.parse(input)
      const snakeData = camelToSnake(validated)
      
      const updateData: any = { ...snakeData }
      if (validated.name) {
        updateData.name_encrypted = validated.name
      }
      if (validated.patientNumber) {
        updateData.patient_number_encrypted = validated.patientNumber
      }
      
      const { data, error } = await supabase
        .from('patients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return snakeToCamel(data) as Patient
    } catch (error) {
      console.error('Error updating patient:', error)
      throw new Error('환자 정보 수정에 실패했습니다')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ is_active: false })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting patient:', error)
      throw new Error('환자 삭제에 실패했습니다')
    }
  },

  async search(query: string): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('is_active', true)
        .or(`name_search.fts.${query},patient_number_encrypted.ilike.%${query}%`)
        .limit(20)
      
      if (error) throw error
      return (data || []).map(item => snakeToCamel(item) as Patient)
    } catch (error) {
      console.error('Error searching patients:', error)
      throw new Error('환자 검색에 실패했습니다')
    }
  }
}