'use client'

import { ItemCategory } from '@/lib/database.types'

/**
 * Data Format Type Definitions
 *
 * This file defines the three distinct data formats used in the schedule system:
 * 1. RPC Flat Format - Returned by database RPC functions (get_calendar_schedules_filtered, get_filtered_schedules)
 * 2. DB Nested Format - Returned by direct database queries with joins
 * 3. UI Format - Expected by UI components (ScheduleWithDetails)
 *
 * Purpose: Eliminate `any` types and provide type safety throughout the data transformation pipeline
 */

// ============================================================================
// 1. RPC FLAT FORMAT
// ============================================================================
// Returned by RPC functions like get_calendar_schedules_filtered
// All fields are at the root level (flat structure)

export interface RpcFlatSchedule {
  // Schedule fields
  schedule_id: string
  patient_id: string
  item_id: string
  next_due_date: string
  interval_weeks: number
  injection_dosage?: number | null
  priority: number
  schedule_status: string

  // Flat patient fields (from JOIN)
  patient_name: string
  patient_care_type: string | null
  patient_number: string

  // Flat doctor fields (from COALESCE)
  doctor_id: string | null
  doctor_name: string  // COALESCE(profiles.name, patients.assigned_doctor_name, '미지정')

  // Flat item fields (from JOIN)
  item_name: string
  item_category: ItemCategory

  // Display metadata (calendar-specific)
  display_date?: string  // For calendar view
  display_type?: 'scheduled' | 'completed'

  // Execution metadata (for completed items)
  execution_id?: string | null
  executed_by?: string | null
  execution_notes?: string | null
  doctor_id_at_completion?: string | null
  care_type_at_completion?: string | null

  // Audit fields
  created_at?: string
  updated_at?: string
  notes?: string | null
}

// ============================================================================
// 2. DB NESTED FORMAT
// ============================================================================
// Returned by direct database queries with `.select()` joins
// Uses PostgreSQL's nested object structure (patients, items, etc.)

export interface DbNestedSchedule {
  // Root schedule fields
  id: string
  patient_id: string
  item_id: string
  next_due_date: string
  interval_weeks: number
  injection_dosage?: number | null
  status: string
  priority?: number
  notes?: string | null
  created_at?: string
  updated_at?: string

  // Nested patient object (from JOIN)
  patients?: {
    id: string
    name: string
    patient_number: string
    care_type?: string | null
    department_id?: string | null
    doctor_id?: string | null
    assigned_doctor_name?: string | null  // For unregistered doctors
    departments?: {
      name: string
    } | null
    profiles?: {  // Doctor profile (if registered)
      name: string
    } | null
  } | null

  // Nested item object (from JOIN)
  items?: {
    id: string
    name: string
    category: ItemCategory
  } | null
}

// ============================================================================
// 3. UI FORMAT (Final Output)
// ============================================================================
// Expected by UI components - combines both flat and nested structures
// This is the existing ScheduleWithDetails type extended

export interface UiSchedule {
  // Schedule identifiers (both formats for compatibility)
  schedule_id: string
  id?: string  // Optional for backward compatibility

  // Patient data (flat)
  patient_id: string
  patient_name: string
  patient_care_type: string
  patient_number: string

  // Doctor data (flat)
  doctor_id: string | null
  doctor_name: string | null

  // Item data (flat)
  item_id: string
  item_name: string
  item_category: ItemCategory

  // Schedule data
  next_due_date: string
  interval_weeks: number
  injection_dosage?: number | null
  status: string
  priority?: number
  notes?: string | null
  care_type?: string | null

  // Display metadata
  display_type?: 'scheduled' | 'completed'

  // Execution metadata
  execution_id?: string | null
  executed_by?: string | null
  doctor_id_at_completion?: string | null
  care_type_at_completion?: string | null

  // Audit (always present from database)
  created_at: string
  updated_at: string

  // Nested objects (optional, for components that expect them)
  patient?: {
    id: string
    name: string
    care_type: string
    careType?: string  // camelCase variant
    patient_number: string
    patientNumber?: string  // camelCase variant
    doctor_id: string | null
    doctorId?: string | null  // camelCase variant
  } | null

  item?: {
    id: string
    name: string
    category: ItemCategory
  } | null
}

// ============================================================================
// TRANSFORMATION FUNCTION TYPES
// ============================================================================

export type RpcToUiTransformer = (rpc: RpcFlatSchedule) => UiSchedule
export type DbToUiTransformer = (db: DbNestedSchedule) => UiSchedule

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isRpcFlatSchedule(data: any): data is RpcFlatSchedule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schedule_id' in data &&
    'patient_name' in data &&
    'item_name' in data &&
    !('patients' in data)  // RPC format doesn't have nested patients
  )
}

export function isDbNestedSchedule(data: any): data is DbNestedSchedule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    ('patients' in data || 'items' in data)  // DB format has nested objects
  )
}

export function isUiSchedule(data: any): data is UiSchedule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schedule_id' in data &&
    'patient_name' in data &&
    'item_name' in data &&
    'doctor_name' in data
  )
}
