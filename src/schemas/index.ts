'use client'

// Export all schemas
export * from './patient'
export * from './item'
export * from './schedule'
export * from './execution'

// Common validation schemas
import { z } from 'zod'

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

// Sort schema
export const SortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

// Date range schema
export const DateRangeSchema = z.object({
  start: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: '유효한 시작 날짜를 입력해주세요',
  }),
  end: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: '유효한 종료 날짜를 입력해주세요',
  }),
}).refine(
  (data) => new Date(data.end) >= new Date(data.start),
  {
    message: '종료일은 시작일 이후여야 합니다',
    path: ['end'],
  }
)

// UUID validation
export const UUIDSchema = z.string().uuid('유효한 ID 형식이 아닙니다')

// Common types
export type Pagination = z.infer<typeof PaginationSchema>
export type Sort = z.infer<typeof SortSchema>
export type DateRange = z.infer<typeof DateRangeSchema>

// Validation helpers
export const validatePagination = (data: unknown) => {
  return PaginationSchema.safeParse(data)
}

export const validateSort = (data: unknown) => {
  return SortSchema.safeParse(data)
}

export const validateDateRange = (data: unknown) => {
  return DateRangeSchema.safeParse(data)
}

export const validateUUID = (data: unknown) => {
  return UUIDSchema.safeParse(data)
}