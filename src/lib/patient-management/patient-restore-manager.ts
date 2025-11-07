'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@/lib/supabase/database'
import type { Patient } from '@/types/patient'
import { toCamelCase } from '@/lib/database-utils'

export interface InactivePatient {
  id: string
  patientNumber: string
  name: string
  careType?: string | null
  archived: boolean
  archivedAt?: string | null
  originalPatientNumber?: string | null
  createdAt: string
}

export interface RestorePatientOptions {
  updateInfo?: {
    name?: string
    careType?: string
  }
}

export interface CreateWithArchiveOptions {
  name: string
  careType?: string
  organizationId: string
  metadata?: Record<string, any>
}

export class PatientRestoreManager {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient()
  }

  async checkForInactivePatient(patientNumber: string): Promise<InactivePatient | null> {
    try {
      console.log('[PatientRestoreManager.checkForInactivePatient] Checking for:', patientNumber)

      // First, check for inactive (soft-deleted) patients
      const { data: inactivePatient, error: inactiveError } = await this.supabase
        .from('patients')
        .select(`
          id,
          patient_number,
          name,
          care_type,
          archived,
          archived_at,
          original_patient_number,
          created_at
        `)
        .eq('patient_number', patientNumber)
        .eq('is_active', false)
        .single()

      if (inactiveError && inactiveError.code !== 'PGRST116') {
        console.error('[PatientRestoreManager.checkForInactivePatient] Error checking inactive:', inactiveError)
        throw inactiveError
      }

      if (inactivePatient) {
        console.log('[PatientRestoreManager.checkForInactivePatient] Found inactive patient:', inactivePatient)
        return toCamelCase(inactivePatient) as InactivePatient
      }

      // Second, check for archived patients with original patient number
      const { data: archivedPatient, error: archivedError } = await this.supabase
        .from('patients')
        .select(`
          id,
          patient_number,
          name,
          care_type,
          archived,
          archived_at,
          original_patient_number,
          created_at
        `)
        .eq('original_patient_number', patientNumber)
        .eq('archived', true)
        .single()

      if (archivedError && archivedError.code !== 'PGRST116') {
        console.error('[PatientRestoreManager.checkForInactivePatient] Error checking archived:', archivedError)
        throw archivedError
      }

      if (archivedPatient) {
        console.log('[PatientRestoreManager.checkForInactivePatient] Found archived patient:', archivedPatient)
        return toCamelCase(archivedPatient) as InactivePatient
      }

      console.log('[PatientRestoreManager.checkForInactivePatient] No inactive or archived patient found')
      return null
    } catch (error) {
      console.error('[PatientRestoreManager.checkForInactivePatient] Unexpected error:', error)
      throw new Error('환자 검색 중 오류가 발생했습니다')
    }
  }

  async restorePatient(
    patientId: string, 
    options: RestorePatientOptions = {}
  ): Promise<Patient> {
    try {
      console.log('[PatientRestoreManager.restorePatient] Restoring patient:', patientId, options)

      // Prepare parameters for atomic restore function
      const updateName = options.updateInfo?.name || null
      const updateCareType = options.updateInfo?.careType || null

      // Call atomic restore function that handles both restoration and updates
      const { data: restoredPatient, error: restoreError } = await this.supabase
        .rpc('restore_patient_atomic', {
          patient_id: patientId,
          update_name: updateName || undefined,
          update_care_type: updateCareType || undefined
        })

      if (restoreError) {
        console.error('[PatientRestoreManager.restorePatient] Error in atomic restore:', restoreError)
        
        // Handle specific error cases
        if (restoreError.message?.includes('not found')) {
          throw new Error('환자 정보를 찾을 수 없습니다')
        }
        throw new Error('환자 복원에 실패했습니다')
      }

      if (!restoredPatient || restoredPatient.length === 0) {
        throw new Error('복원된 환자 정보를 불러오는데 실패했습니다')
      }

      // The function returns an array with one record, get the first element
      const patientData = restoredPatient[0]
      console.log('[PatientRestoreManager.restorePatient] Successfully restored patient:', patientData)
      
      return toCamelCase(patientData) as Patient
    } catch (error) {
      console.error('[PatientRestoreManager.restorePatient] Unexpected error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 복원 중 오류가 발생했습니다')
    }
  }

  async createWithArchive(
    patientNumber: string,
    options: CreateWithArchiveOptions
  ): Promise<Patient> {
    try {
      console.log('[PatientRestoreManager.createWithArchive] Creating new patient with archive:', patientNumber, options)

      // First, find and archive the existing inactive patient
      const inactivePatient = await this.checkForInactivePatient(patientNumber)
      
      if (inactivePatient && !inactivePatient.archived) {
        // Archive the existing inactive patient
        const { error: archiveError } = await this.supabase
          .rpc('archive_patient_with_timestamp', { patient_id: inactivePatient.id })

        if (archiveError) {
          console.error('[PatientRestoreManager.createWithArchive] Error archiving existing patient:', archiveError)
          throw new Error('기존 환자 아카이빙에 실패했습니다')
        }

        console.log('[PatientRestoreManager.createWithArchive] Successfully archived existing patient:', inactivePatient.id)
      }

      // Now create the new patient
      const insertData = {
        patient_number: patientNumber,
        name: options.name,
        care_type: options.careType || null,
        organization_id: options.organizationId,
        is_active: true,
        archived: false,
        metadata: options.metadata || {}
      }

      const { data: newPatient, error: insertError } = await this.supabase
        .from('patients')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('[PatientRestoreManager.createWithArchive] Error creating new patient:', insertError)
        
        if (insertError.code === '23505') {
          throw new Error('환자번호가 이미 사용중입니다')
        }
        throw new Error('새 환자 등록에 실패했습니다')
      }

      console.log('[PatientRestoreManager.createWithArchive] Successfully created new patient:', newPatient)
      return toCamelCase(newPatient) as Patient
    } catch (error) {
      console.error('[PatientRestoreManager.createWithArchive] Unexpected error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 생성 중 오류가 발생했습니다')
    }
  }

  async getArchiveHistory(patientNumber: string): Promise<InactivePatient[]> {
    try {
      console.log('[PatientRestoreManager.getArchiveHistory] Getting archive history for:', patientNumber)

      const { data: archivedPatients, error } = await this.supabase
        .from('patients')
        .select(`
          id,
          patient_number,
          name,
          care_type,
          archived,
          archived_at,
          original_patient_number,
          created_at
        `)
        .eq('original_patient_number', patientNumber)
        .eq('archived', true)
        .order('archived_at', { ascending: false })

      if (error) {
        console.error('[PatientRestoreManager.getArchiveHistory] Error fetching archive history:', error)
        throw error
      }

      return (archivedPatients || []).map(patient => toCamelCase(patient) as InactivePatient)
    } catch (error) {
      console.error('[PatientRestoreManager.getArchiveHistory] Unexpected error:', error)
      throw new Error('아카이브 히스토리 조회에 실패했습니다')
    }
  }
}

export const patientRestoreManager = new PatientRestoreManager()