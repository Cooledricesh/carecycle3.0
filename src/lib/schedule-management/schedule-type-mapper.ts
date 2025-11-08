'use client'

import type { Schedule, ScheduleRow, ScheduleWithDetails } from '@/types/schedule'
import type { Database } from '@/lib/database.types'

type ScheduleRPCResponse = Database['public']['Functions']['get_filtered_schedules']['Returns'][0]

/**
 * Converts database row (snake_case) to Schedule type (camelCase)
 */
export function convertRowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    patientId: row.patient_id,
    itemId: row.item_id,
    intervalWeeks: row.interval_weeks,
    startDate: row.start_date,
    endDate: row.end_date,
    lastExecutedDate: row.last_executed_date,
    nextDueDate: row.next_due_date,
    status: row.status ?? 'active',
    assignedNurseId: row.assigned_nurse_id,
    notes: row.notes,
    priority: row.priority ?? 0,
    requiresNotification: row.requires_notification ?? false,
    notificationDaysBefore: row.notification_days_before ?? 1,
    createdBy: row.created_by,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Converts RPC response to ScheduleWithDetails
 */
export function convertRPCToScheduleWithDetails(rpc: ScheduleRPCResponse): ScheduleWithDetails {
  return {
    schedule_id: rpc.schedule_id,
    patient_id: rpc.patient_id,
    patient_name: rpc.patient_name,
    patient_care_type: rpc.patient_care_type,
    patient_number: rpc.patient_number,
    doctor_id: rpc.doctor_id,
    doctor_name: rpc.doctor_name ?? '',
    item_id: rpc.item_id,
    item_name: rpc.item_name,
    item_category: rpc.item_category as any,
    next_due_date: rpc.next_due_date,
    status: rpc.status,
    interval_weeks: rpc.interval_weeks,
    priority: rpc.priority ?? undefined,
    created_at: rpc.created_at,
    updated_at: rpc.updated_at,
    notes: rpc.notes ?? undefined,
  }
}

/**
 * Type guard to check if data has patient/item relations
 */
export function hasRelations(data: any): data is { patients: any; items: any } {
  return data && typeof data === 'object' && 'patients' in data && 'items' in data
}

/**
 * Safely extract patient name from various data structures
 */
export function extractPatientName(data: any): string {
  if (!data) return ''

  // Direct field
  if (data.patient_name) return data.patient_name

  // Nested patient object
  if (data.patients) {
    if (typeof data.patients === 'string') return data.patients
    if (data.patients.name) return data.patients.name
  }

  return ''
}

/**
 * Safely extract item name from various data structures
 */
export function extractItemName(data: any): string {
  if (!data) return ''

  // Direct field
  if (data.item_name) return data.item_name

  // Nested item object
  if (data.items) {
    if (typeof data.items === 'string') return data.items
    if (data.items.name) return data.items.name
  }

  return ''
}

/**
 * Safely extract patient care type
 */
export function extractCareType(data: any): string {
  if (!data) return ''

  if (data.patient_care_type) return data.patient_care_type

  if (data.patients?.care_type) return data.patients.care_type
  if (data.patients?.careType) return data.patients.careType

  return ''
}

/**
 * Safely extract doctor ID
 */
export function extractDoctorId(data: any): string | null {
  if (!data) return null

  if (data.doctor_id !== undefined) return data.doctor_id

  if (data.patients?.doctor_id !== undefined) return data.patients.doctor_id
  if (data.patients?.doctorId !== undefined) return data.patients.doctorId

  return null
}
