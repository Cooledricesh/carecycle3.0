'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@/lib/supabase/database'
import type { Patient } from '@/types/patient'
import { toCamelCase } from '@/lib/database-utils'

export interface ArchiveResult {
  originalPatient: Patient
  archivedPatientId: string
  archivedPatientNumber: string
  timestamp: string
}

export interface ArchiveOptions {
  reason?: string
  preserveSchedules?: boolean
}

export interface ArchiveHistoryEntry {
  id: string
  originalPatientNumber: string
  archivedPatientNumber: string
  patientName: string
  archivedAt: string
  reason?: string
}

export class PatientArchiveService {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient()
  }

  async archivePatient(
    patientId: string, 
    options: ArchiveOptions = {}
  ): Promise<ArchiveResult> {
    try {
      console.log('[PatientArchiveService.archivePatient] Archiving patient:', patientId, options)

      // First, get the current patient data
      const { data: originalPatient, error: fetchError } = await this.supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (fetchError) {
        console.error('[PatientArchiveService.archivePatient] Error fetching patient:', fetchError)
        throw new Error('환자 정보를 찾을 수 없습니다')
      }

      if (!originalPatient.is_active || originalPatient.archived) {
        const reason = !originalPatient.is_active ? '비활성화' : '아카이빙'
        throw new Error(`이미 ${reason}된 환자입니다`)
      }

      // Archive the patient using the database function
      const { error: archiveError } = await this.supabase
        .rpc('archive_patient_with_timestamp', { patient_id: patientId })

      if (archiveError) {
        console.error('[PatientArchiveService.archivePatient] Error archiving patient:', archiveError)
        throw new Error('환자 아카이빙에 실패했습니다')
      }

      // Get the archived patient data to return the new patient number
      const { data: archivedPatient, error: archivedFetchError } = await this.supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (archivedFetchError) {
        console.error('[PatientArchiveService.archivePatient] Error fetching archived patient:', archivedFetchError)
        throw new Error('아카이빙된 환자 정보를 조회할 수 없습니다')
      }

      // Handle related schedules if needed
      if (options.preserveSchedules) {
        await this.handleRelatedSchedules(patientId, 'preserve')
      } else {
        await this.handleRelatedSchedules(patientId, 'deactivate')
      }

      const result: ArchiveResult = {
        originalPatient: toCamelCase(originalPatient) as Patient,
        archivedPatientId: patientId,
        archivedPatientNumber: archivedPatient.patient_number,
        timestamp: archivedPatient.archived_at
      }

      console.log('[PatientArchiveService.archivePatient] Successfully archived patient:', result)
      return result
    } catch (error) {
      console.error('[PatientArchiveService.archivePatient] Unexpected error:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('환자 아카이빙 중 오류가 발생했습니다')
    }
  }

  private async handleRelatedSchedules(
    patientId: string, 
    action: 'preserve' | 'deactivate'
  ): Promise<void> {
    try {
      console.log('[PatientArchiveService.handleRelatedSchedules] Handling schedules:', patientId, action)

      if (action === 'deactivate') {
        // Soft delete all related schedules
        const { error: schedulesError } = await this.supabase
          .from('schedules')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('patient_id', patientId)
          .eq('is_active', true)

        if (schedulesError) {
          console.error('[PatientArchiveService.handleRelatedSchedules] Error deactivating schedules:', schedulesError)
          // Log but don't throw - patient archiving is more important
          console.warn('환자 아카이빙은 완료되었지만 관련 스케줄 비활성화에 실패했습니다')
        }
      }
      // For 'preserve', we don't need to do anything - schedules remain active
    } catch (error) {
      console.error('[PatientArchiveService.handleRelatedSchedules] Unexpected error:', error)
      // Log but don't throw - don't fail the whole archiving process
      console.warn('스케줄 처리 중 오류가 발생했지만 환자 아카이빙은 계속 진행합니다')
    }
  }

  async getArchiveHistory(originalPatientNumber?: string): Promise<ArchiveHistoryEntry[]> {
    try {
      console.log('[PatientArchiveService.getArchiveHistory] Getting archive history for:', originalPatientNumber)

      let query = this.supabase
        .from('patients')
        .select(`
          id,
          patient_number,
          name,
          original_patient_number,
          archived_at
        `)
        .eq('archived', true)
        .order('archived_at', { ascending: false })

      if (originalPatientNumber) {
        query = query.eq('original_patient_number', originalPatientNumber)
      }

      const { data: archivedPatients, error } = await query

      if (error) {
        console.error('[PatientArchiveService.getArchiveHistory] Error fetching archive history:', error)
        throw error
      }

      return (archivedPatients || []).map(patient => ({
        id: patient.id,
        originalPatientNumber: patient.original_patient_number || '',
        archivedPatientNumber: patient.patient_number,
        patientName: patient.name,
        archivedAt: patient.archived_at || ''
      }))
    } catch (error) {
      console.error('[PatientArchiveService.getArchiveHistory] Unexpected error:', error)
      throw new Error('아카이브 히스토리 조회에 실패했습니다')
    }
  }

  async bulkArchiveInactivePatients(olderThanDays: number = 90): Promise<{
    processedCount: number
    errors: string[]
  }> {
    try {
      console.log('[PatientArchiveService.bulkArchiveInactivePatients] Starting bulk archive for patients inactive for more than', olderThanDays, 'days')

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      // Find inactive patients older than cutoff date
      const { data: inactivePatients, error: fetchError } = await this.supabase
        .from('patients')
        .select('id, patient_number, name, updated_at')
        .eq('is_active', false)
        .eq('archived', false)
        .lt('updated_at', cutoffDate.toISOString())
        .limit(100) // Process in batches to avoid timeouts

      if (fetchError) {
        console.error('[PatientArchiveService.bulkArchiveInactivePatients] Error fetching inactive patients:', fetchError)
        throw new Error('비활성 환자 조회에 실패했습니다')
      }

      const errors: string[] = []
      let processedCount = 0

      if (!inactivePatients || inactivePatients.length === 0) {
        console.log('[PatientArchiveService.bulkArchiveInactivePatients] No patients to archive')
        return { processedCount: 0, errors: [] }
      }

      // Perform bulk archive in a single database transaction
      const reasonText = `일괄 아카이브 - ${olderThanDays}일 동안 비활성`

      try {
        // Use database transaction for atomic bulk operation
        const { data: result, error: bulkError } = await this.supabase.rpc('bulk_archive_patients', {
          patient_ids: inactivePatients.map(p => p.id),
          archive_reason: reasonText
        })

        if (bulkError) {
          console.error('[PatientArchiveService.bulkArchiveInactivePatients] Bulk archive failed:', bulkError)
          throw new Error(`일괄 아카이브 실패: ${bulkError.message}`)
        }

        processedCount = result?.processed_count || 0
        
        // Log successful archiving for each patient
        inactivePatients.slice(0, processedCount).forEach(patient => {
          console.log(`[PatientArchiveService.bulkArchiveInactivePatients] Archived patient ${patient.patient_number}`)
        })

      } catch (bulkArchiveError) {
        // If bulk archive fails, fall back to individual processing for better error reporting
        console.warn('[PatientArchiveService.bulkArchiveInactivePatients] Bulk operation failed, falling back to individual processing:', bulkArchiveError)
        
        for (const patient of inactivePatients) {
          try {
            await this.archivePatient(patient.id, { reason: reasonText })
            processedCount++
            console.log(`[PatientArchiveService.bulkArchiveInactivePatients] Archived patient ${patient.patient_number}`)
          } catch (error) {
            const errorMsg = `환자 ${patient.patient_number} 아카이브 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
            errors.push(errorMsg)
            console.error('[PatientArchiveService.bulkArchiveInactivePatients]', errorMsg)
          }
        }
      }

      console.log(`[PatientArchiveService.bulkArchiveInactivePatients] Completed bulk archive. Processed: ${processedCount}, Errors: ${errors.length}`)
      return { processedCount, errors }
    } catch (error) {
      console.error('[PatientArchiveService.bulkArchiveInactivePatients] Unexpected error:', error)
      throw new Error('일괄 아카이빙 중 오류가 발생했습니다')
    }
  }

  async cleanupOldArchives(olderThanMonths: number = 12): Promise<{
    deletedCount: number
    errors: string[]
  }> {
    try {
      console.log('[PatientArchiveService.cleanupOldArchives] Starting cleanup of archives older than', olderThanMonths, 'months')

      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths)

      // Find old archived patients
      const { data: oldArchives, error: fetchError } = await this.supabase
        .from('patients')
        .select('id, patient_number, archived_at')
        .eq('archived', true)
        .lt('archived_at', cutoffDate.toISOString())
        .limit(50) // Process in smaller batches for cleanup

      if (fetchError) {
        console.error('[PatientArchiveService.cleanupOldArchives] Error fetching old archives:', fetchError)
        throw new Error('오래된 아카이브 조회에 실패했습니다')
      }

      const errors: string[] = []
      let deletedCount = 0

      for (const archive of oldArchives || []) {
        try {
          // Hard delete old archived patients
          const { error: deleteError } = await this.supabase
            .from('patients')
            .delete()
            .eq('id', archive.id)

          if (deleteError) {
            const errorMsg = `Failed to delete archived patient ${archive.patient_number}: ${deleteError.message}`
            errors.push(errorMsg)
            console.error('[PatientArchiveService.cleanupOldArchives]', errorMsg)
          } else {
            deletedCount++
            console.log(`[PatientArchiveService.cleanupOldArchives] Deleted archived patient ${archive.patient_number}`)
          }
        } catch (error) {
          const errorMsg = `Failed to delete archived patient ${archive.patient_number}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error('[PatientArchiveService.cleanupOldArchives]', errorMsg)
        }
      }

      console.log(`[PatientArchiveService.cleanupOldArchives] Completed cleanup. Deleted: ${deletedCount}, Errors: ${errors.length}`)
      return { deletedCount, errors }
    } catch (error) {
      console.error('[PatientArchiveService.cleanupOldArchives] Unexpected error:', error)
      throw new Error('아카이브 정리 중 오류가 발생했습니다')
    }
  }
}

export const patientArchiveService = new PatientArchiveService()