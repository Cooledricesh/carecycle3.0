'use client'

import { z } from 'zod'
import { ScheduleStatus } from '@/lib/database.types'

// Schedule status
export const ScheduleStatusSchema = z.enum(['active', 'paused', 'completed', 'cancelled'])

// Date validation helpers with proper timezone handling
const isValidDate = (dateString: string) => {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

const isFutureOrToday = (dateString: string) => {
  // Parse as UTC date to avoid timezone issues
  const date = new Date(dateString + 'T00:00:00.000Z')
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return date >= today
}

// Allow any valid date including past dates
const isAnyValidDate = (dateString: string) => {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

// Base validation schemas
export const ScheduleCreateSchema = z.object({
  patientId: z
    .string()
    .uuid('유효한 환자 ID가 아닙니다'),
  
  itemId: z
    .string()
    .uuid('유효한 항목 ID가 아닙니다'),
  
  intervalWeeks: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1주 이상 입력해주세요')
    .max(52, '최대 52주까지 입력 가능합니다'),
  
  startDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  
  endDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .nullable()
    .optional(),
  
  assignedNurseId: z
    .string()
    .uuid('유효한 ID가 아닙니다')
    .nullable()
    .optional(),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  priority: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '우선순위는 0 이상이어야 합니다')
    .max(10, '우선순위는 10 이하여야 합니다')
    .default(0),
  
  requiresNotification: z
    .boolean()
    .default(false),
  
  notificationDaysBefore: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '0일 이상 입력해주세요')
    .max(30, '최대 30일까지 입력 가능합니다')
    .default(7),
}).refine(
  (data) => {
    if (data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate)
    }
    return true
  },
  {
    message: '종료일은 시작일 이후여야 합니다',
    path: ['endDate'],
  }
)

export const ScheduleUpdateSchema = z.object({
  intervalWeeks: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1주 이상 입력해주세요')
    .max(52, '최대 52주까지 입력 가능합니다')
    .optional(),
  
  startDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .optional(),
  
  endDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .nullable()
    .optional(),
  
  status: ScheduleStatusSchema.optional(),
  
  assignedNurseId: z
    .string()
    .uuid('유효한 ID가 아닙니다')
    .nullable()
    .optional(),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  priority: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '우선순위는 0 이상이어야 합니다')
    .max(10, '우선순위는 10 이하여야 합니다')
    .optional(),
  
  requiresNotification: z
    .boolean()
    .optional(),
  
  notificationDaysBefore: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '0일 이상 입력해주세요')
    .max(30, '최대 30일까지 입력 가능합니다')
    .optional(),
})

// Bulk schedule creation
export const BulkScheduleCreateSchema = z.object({
  patientIds: z
    .array(z.string().uuid('유효한 환자 ID가 아닙니다'))
    .min(1, '최소 1명 이상의 환자를 선택해주세요')
    .max(100, '한 번에 최대 100명까지 선택 가능합니다'),
  
  itemId: z
    .string()
    .uuid('유효한 항목 ID가 아닙니다'),
  
  intervalWeeks: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1주 이상 입력해주세요')
    .max(52, '최대 52주까지 입력 가능합니다'),
  
  startDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  
  assignedNurseId: z
    .string()
    .uuid('유효한 ID가 아닙니다')
    .nullable()
    .optional(),
  
  requiresNotification: z
    .boolean()
    .optional(),
})

// Search/Filter validation
export const ScheduleFilterSchema = z.object({
  patientId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  status: ScheduleStatusSchema.optional(),
  assignedNurseId: z.string().uuid().optional(),
  dateRange: z.object({
    start: z.string().refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
    end: z.string().refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  }).optional(),
  overdue: z.boolean().optional(),
})

// Type exports
export type ScheduleCreateInput = z.infer<typeof ScheduleCreateSchema>
export type ScheduleUpdateInput = z.infer<typeof ScheduleUpdateSchema>
export type BulkScheduleCreateInput = z.infer<typeof BulkScheduleCreateSchema>
export type ScheduleFilter = z.infer<typeof ScheduleFilterSchema>

// Validation helper functions
export const validateScheduleCreate = (data: unknown) => {
  return ScheduleCreateSchema.safeParse(data)
}

export const validateScheduleUpdate = (data: unknown) => {
  return ScheduleUpdateSchema.safeParse(data)
}

export const validateBulkScheduleCreate = (data: unknown) => {
  return BulkScheduleCreateSchema.safeParse(data)
}

export const validateScheduleFilter = (data: unknown) => {
  return ScheduleFilterSchema.safeParse(data)
}

// Schedule Edit Schema - Simple 3-field validation
export const ScheduleEditSchema = z.object({
  itemName: z
    .string()
    .min(1, '검사/주사명을 입력하세요')
    .max(100, '검사/주사명은 100자 이내로 입력하세요'),

  intervalWeeks: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1주 이상 입력해주세요')
    .max(52, '최대 52주까지 입력 가능합니다'),

  nextDueDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .optional(),

  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional()
})

// Schedule Edit type
export type ScheduleEditInput = z.infer<typeof ScheduleEditSchema>

// Schedule Edit validation helper
export const validateScheduleEdit = (data: unknown) => {
  return ScheduleEditSchema.safeParse(data)
}

// Schedule Create With Custom Item Schema
export const ScheduleCreateWithCustomItemSchema = z.object({
  patientId: z
    .string()
    .uuid('유효한 환자 ID가 아닙니다'),

  itemName: z
    .string()
    .min(1, '검사/주사명을 입력하세요')
    .max(100, '검사/주사명은 100자 이내로 입력하세요')
    .trim(),

  intervalWeeks: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1주 이상 입력해주세요')
    .max(52, '최대 52주까지 입력 가능합니다'),

  intervalUnit: z
    .enum(['week', 'month', 'year'], {
      errorMap: () => ({ message: '유효한 주기 단위를 선택하세요' })
    }),

  intervalValue: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1 이상 입력해주세요')
    .max(365, '최대 365까지 입력 가능합니다'),

  startDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),

  nextDueDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),

  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),

  category: z
    .enum(['injection', 'test', 'other'], {
      errorMap: () => ({ message: '유효한 카테고리를 선택하세요 (injection, test, other)' })
    })
    .nullable()
    .optional()
    .default('other'),

  notificationDaysBefore: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '알림 일수는 0일 이상이어야 합니다')
    .max(30, '알림 일수는 최대 30일까지 설정 가능합니다')
    .nullable()
    .optional()
    .transform(val => val === null || val === undefined ? 0 : val) // null/undefined는 0으로 처리 (알림 없음)
}).refine(
  (data) => {
    // nextDueDate는 startDate 이후여야 함
    return new Date(data.nextDueDate) >= new Date(data.startDate)
  },
  {
    message: '다음 시행일은 시작일 이후여야 합니다',
    path: ['nextDueDate'],
  }
)

// Schedule Create With Custom Item type
export type ScheduleCreateWithCustomItemInput = z.infer<typeof ScheduleCreateWithCustomItemSchema>

// Schedule Create With Custom Item validation helper
export const validateScheduleCreateWithCustomItem = (data: unknown) => {
  return ScheduleCreateWithCustomItemSchema.safeParse(data)
}