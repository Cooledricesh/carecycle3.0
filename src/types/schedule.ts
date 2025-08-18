'use client'

import { Database, ScheduleStatus } from './database.types'
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
  intervalDays: number
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

// Extended types with relations
export interface ScheduleWithRelations extends Schedule {
  patient?: Patient
  item?: Item
  assignedNurse?: {
    id: string
    name: string | null
  }
}

// Form input types
export interface ScheduleCreateInput {
  patientId: string
  itemId: string
  intervalDays: number
  startDate: string
  endDate?: string | null
  assignedNurseId?: string | null
  notes?: string | null
  priority?: number
  requiresNotification?: boolean
  notificationDaysBefore?: number
}

export interface ScheduleUpdateInput {
  intervalDays?: number
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
  intervalDays: number
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
  intervalDays: number
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
  }
  return labels[status] || status
}

export const getScheduleStatusColor = (status: ScheduleStatus): string => {
  const colors: Record<ScheduleStatus, string> = {
    active: 'success',
    paused: 'warning',
    completed: 'default',
    cancelled: 'destructive',
  }
  return colors[status] || 'default'
}