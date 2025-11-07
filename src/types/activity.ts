'use client'

import { Database } from '@/lib/database.types'

export type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']

export type ActivityOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'UNKNOWN'

export type ActivityTableName =
  | 'patients'
  | 'schedules'
  | 'schedule_executions'
  | 'profiles'
  | 'items'
  | 'auth'

export interface AuditLog {
  id: string
  tableName: string
  operation: ActivityOperation
  recordId: string | null
  oldValues: Record<string, any> | null
  newValues: Record<string, any> | null
  userId: string | null
  userEmail: string | null
  userName: string | null
  userRole: string | null
  timestamp: string
  ipAddress: string | null
  userAgent: string | null
}

export interface ActivityStats {
  totalUsers: number
  activeUsers: number
  todayActivities: number
  systemStatus: 'healthy' | 'warning' | 'error'
  criticalAlerts: number
}

export interface ActivityFilters {
  startDate?: string
  endDate?: string
  userId?: string
  tableName?: ActivityTableName
  operation?: ActivityOperation
  page?: number
  limit?: number
}

export interface PaginatedAuditLogs {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ActivityItemDisplay {
  id: string
  timestamp: string
  userName: string
  userEmail: string
  userRole: string
  operation: ActivityOperation
  tableName: string
  description: string
  hasChanges: boolean
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
}