'use client'

import { Database, ItemCategory } from '@/lib/database.types'

// Base types from database
export type ItemRow = Database['public']['Tables']['items']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']

// Application-level types
export interface Item {
  id: string
  code: string
  name: string
  category: ItemCategory
  defaultIntervalWeeks: number
  description?: string | null
  instructions?: string | null
  preparationNotes?: string | null
  requiresNotification: boolean
  notificationDaysBefore: number
  isActive: boolean
  sortOrder: number
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Form input types
export interface ItemCreateInput {
  code: string
  name: string
  category: ItemCategory
  defaultIntervalWeeks?: number
  description?: string | null
  instructions?: string | null
  preparationNotes?: string | null
  requiresNotification?: boolean
  notificationDaysBefore?: number
  isActive?: boolean
  sortOrder?: number
}

export interface ItemUpdateInput {
  code?: string
  name?: string
  category?: ItemCategory
  defaultIntervalWeeks?: number
  description?: string | null
  instructions?: string | null
  preparationNotes?: string | null
  requiresNotification?: boolean
  notificationDaysBefore?: number
  isActive?: boolean
  sortOrder?: number
}

// List/Filter types
export interface ItemFilter {
  category?: ItemCategory
  isActive?: boolean
  requiresNotification?: boolean
  searchTerm?: string
}

export interface ItemListItem {
  id: string
  code: string
  name: string
  category: ItemCategory
  defaultIntervalWeeks: number
  isActive: boolean
  activeScheduleCount?: number
}

// Interval helper types
export interface IntervalOption {
  value: number
  label: string
  description: string
}

export const COMMON_INTERVALS: IntervalOption[] = [
  { value: 1, label: '1주', description: '매주' },
  { value: 2, label: '2주', description: '격주' },
  { value: 4, label: '4주', description: '매월' },
  { value: 8, label: '8주', description: '2개월마다' },
  { value: 12, label: '12주', description: '3개월마다' },
  { value: 24, label: '24주', description: '6개월마다' },
]