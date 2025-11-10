'use client'

import { Database } from '@/lib/database.types'
import { Schedule } from './schedule'
import { Patient } from './patient'
import { Item } from './item'

// Export execution status type from database enums
export type ExecutionStatus = Database['public']['Enums']['execution_status']

// Base types from database
export type ExecutionRow = Database['public']['Tables']['schedule_executions']['Row']
export type ExecutionInsert = Database['public']['Tables']['schedule_executions']['Insert']
export type ExecutionUpdate = Database['public']['Tables']['schedule_executions']['Update']

// Application-level types
export interface ScheduleExecution {
  id: string
  scheduleId: string
  plannedDate: string
  executedDate?: string | null
  executedTime?: string | null
  status: ExecutionStatus
  executedBy?: string | null
  notes?: string | null
  skippedReason?: string | null
  isRescheduled: boolean
  originalDate?: string | null
  metadata?: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

// Extended types with relations
export interface ExecutionWithRelations extends ScheduleExecution {
  schedule?: Schedule
  patient?: Patient
  item?: Item
  executor?: {
    id: string
    name: string | null
  }
}

// Today's checklist type (from view)
export interface TodayChecklistItem {
  executionId: string
  scheduleId: string
  patientId: string
  patientName: string | null
  patientNumber: string | null
  department?: string | null
  itemName: string
  itemCategory: string
  instructions?: string | null
  plannedDate: string
  executedDate?: string | null
  executedTime?: string | null
  executionStatus: ExecutionStatus
  assignedNurseId?: string | null
  assignedNurseName?: string | null
  scheduleNotes?: string | null
  executionNotes?: string | null
  priority: number
}

// Form input types
export interface ExecutionCreateInput {
  scheduleId: string
  plannedDate: string
  status?: ExecutionStatus
  notes?: string | null
}

export interface ExecutionUpdateInput {
  executedDate?: string | null
  executedTime?: string | null
  status?: ExecutionStatus
  notes?: string | null
  skippedReason?: string | null
}

export interface ExecutionCompleteInput {
  executedDate: string
  executedTime?: string
  notes?: string | null
  metadata?: Record<string, any> | null
}

export interface ExecutionSkipInput {
  skippedReason: string
  rescheduleDate?: string | null
}

// List/Filter types
export interface ExecutionFilter {
  scheduleId?: string
  status?: ExecutionStatus
  dateRange?: {
    start: string
    end: string
  }
  executedBy?: string
}

export interface ExecutionListItem {
  id: string
  patientName: string
  itemName: string
  plannedDate: string
  executedDate?: string | null
  status: ExecutionStatus
  executorName?: string | null
  isOverdue: boolean
}

// Dashboard summary type (from view)
export interface DashboardSummary {
  completedCount: number
  plannedCount: number
  overdueCount: number
  totalCount: number
  upcomingSchedules: number
  completionRate: number
}

// Status helpers
export const getExecutionStatusLabel = (status: ExecutionStatus): string => {
  const labels: Record<ExecutionStatus, string> = {
    planned: '예정',
    completed: '완료',
    skipped: '건너뜀',
    overdue: '지연',
  }
  return labels[status] || status
}

export const getExecutionStatusColor = (status: ExecutionStatus): string => {
  const colors: Record<ExecutionStatus, string> = {
    planned: 'default',
    completed: 'success',
    skipped: 'warning',
    overdue: 'destructive',
  }
  return colors[status] || 'default'
}

// Helper functions
export const isOverdue = (plannedDate: string, status: ExecutionStatus): boolean => {
  if (status === 'completed' || status === 'skipped') return false
  const today = new Date().toISOString().split('T')[0]
  return plannedDate < today
}