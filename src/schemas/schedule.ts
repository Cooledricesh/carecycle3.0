'use client'

import { z } from 'zod'
import { ScheduleStatus } from '@/types/database.types'

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
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .refine(isFutureOrToday, '시작일은 오늘 이후로 설정해주세요'),
  
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
  intervalDays: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1일 이상 입력해주세요')
    .max(365, '최대 365일까지 입력 가능합니다')
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
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .refine(isFutureOrToday, '시작일은 오늘 이후로 설정해주세요'),
  
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