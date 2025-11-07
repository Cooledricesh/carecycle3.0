'use client'

import { Database, ScheduleStatus, ItemCategory } from '@/lib/database.types'
import { Patient } from './patient'
import { Item } from './item'

// Base types from database
export type ScheduleRow = Database['public']['Tables']['schedules']['Row']
export type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
export type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']

// Application-level types
export interface Schedule {
  id: string
  patientId: string
  itemId: string
  intervalWeeks: number
  startDate: string
  endDate?: string | null
  lastExecutedDate?: string | null
  nextDueDate: string
  status: ScheduleStatus
  assignedNurseId?: string | null
  notes?: string | null
  priority: number
  requiresNotification: boolean
  notificationDaysBefore: number
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

// Extended types with relations (for direct database queries)
export interface ScheduleWithRelations extends Schedule {
  patient?: Patient
  item?: Item
  assignedNurse?: {
    id: string
    name: string | null
  }
}

// Flat structure from RPC functions (matches get_filtered_schedules response)
export interface ScheduleWithDetails {
  schedule_id: string
  patient_id: string
  patient_name: string
  patient_care_type: string
  patient_number: string
  doctor_id: string | null
  doctor_name: string
  item_id: string
  item_name: string
  item_category: ItemCategory
  next_due_date: string
  status: string
  interval_weeks: number
  priority?: number
  created_at: string
  updated_at: string
  notes?: string | null
}

// Form input types
export interface ScheduleCreateInput {
  patientId: string
  itemId: string
  intervalWeeks: number
  startDate: string
  endDate?: string | null
  assignedNurseId?: string | null
  notes?: string | null
  priority?: number
  requiresNotification?: boolean
  notificationDaysBefore?: number
}

export interface ScheduleUpdateInput {
  intervalWeeks?: number
  startDate?: string
  endDate?: string | null
  status?: ScheduleStatus
  assignedNurseId?: string | null
  notes?: string | null
  priority?: number
  requiresNotification?: boolean
  notificationDaysBefore?: number
}

// Bulk operations
export interface BulkScheduleCreateInput {
  patientIds: string[]
  itemId: string
  intervalWeeks: number
  startDate: string
  assignedNurseId?: string | null
  requiresNotification?: boolean
}

// List/Filter types
export interface ScheduleFilter {
  patientId?: string
  itemId?: string
  status?: ScheduleStatus
  assignedNurseId?: string
  dateRange?: {
    start: string
    end: string
  }
  overdue?: boolean
}

export interface ScheduleListItem {
  id: string
  patientName: string
  patientNumber: string
  itemName: string
  itemCategory: string
  intervalWeeks: number
  nextDueDate: string
  status: ScheduleStatus
  assignedNurseName?: string | null
  daysUntilDue: number
  isOverdue: boolean
}

// Status helpers
export const getScheduleStatusLabel = (status: ScheduleStatus): string => {
  const labels: Record<ScheduleStatus, string> = {
    active: '활성',
    paused: '일시중지',
    completed: '완료',
    cancelled: '취소',
    deleted: '삭제',
  }
  return labels[status] || status
}

export const getScheduleStatusColor = (status: ScheduleStatus): string => {
  const colors: Record<ScheduleStatus, string> = {
    active: 'success',
    paused: 'warning',
    completed: 'default',
    cancelled: 'destructive',
    deleted: 'destructive',
  }
  return colors[status] || 'default'
}