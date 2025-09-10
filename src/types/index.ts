'use client'

// Domain types
export * from './patient'
export * from './item'
export * from './schedule'
export * from './execution'

// Common utility types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

export interface DateRange {
  start: string
  end: string
}

// User/Auth types
export interface User {
  id: string
  email: string
  name?: string | null
  role: 'nurse' | 'admin' | 'user'
  department?: string | null
  isActive: boolean
}