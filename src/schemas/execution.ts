'use client'

import { z } from 'zod'
import { ExecutionStatus } from '@/types/execution'

// Execution status
export const ExecutionStatusSchema = z.enum(['planned', 'completed', 'skipped', 'overdue'])

// Date/Time validation helpers
const isValidDate = (dateString: string) => {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

const isValidTime = (timeString: string) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
  return timeRegex.test(timeString)
}

// Base validation schemas
export const ExecutionCreateSchema = z.object({
  scheduleId: z
    .string()
    .uuid('유효한 일정 ID가 아닙니다'),
  
  plannedDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  
  status: ExecutionStatusSchema
    .default('planned'),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
})

export const ExecutionUpdateSchema = z.object({
  executedDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .nullable()
    .optional(),
  
  executedTime: z
    .string()
    .refine(isValidTime, '유효한 시간 형식이 아닙니다 (HH:MM)')
    .nullable()
    .optional(),
  
  status: ExecutionStatusSchema
    .optional(),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  skippedReason: z
    .string()
    .max(200, '스킵 사유는 200자 이내로 입력해주세요')
    .nullable()
    .optional(),
}).refine(
  (data) => {
    // 완료 상태일 때는 실행일이 필수
    if (data.status === 'completed' && !data.executedDate) {
      return false
    }
    return true
  },
  {
    message: '완료 처리 시 실행일을 입력해주세요',
    path: ['executedDate'],
  }
).refine(
  (data) => {
    // 스킵 상태일 때는 스킵 사유가 필수
    if (data.status === 'skipped' && !data.skippedReason) {
      return false
    }
    return true
  },
  {
    message: '건너뛰기 시 사유를 입력해주세요',
    path: ['skippedReason'],
  }
)

// Complete execution
export const ExecutionCompleteSchema = z.object({
  executedDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  
  executedTime: z
    .string()
    .refine(isValidTime, '유효한 시간 형식이 아닙니다 (HH:MM)')
    .optional(),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
})

// Skip execution
export const ExecutionSkipSchema = z.object({
  skippedReason: z
    .string()
    .min(1, '스킵 사유를 입력해주세요')
    .max(200, '스킵 사유는 200자 이내로 입력해주세요'),
  
  rescheduleDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .nullable()
    .optional(),
})

// Bulk execution operations
export const BulkExecutionCompleteSchema = z.object({
  executionIds: z
    .array(z.string().uuid('유효한 실행 ID가 아닙니다'))
    .min(1, '최소 1개 이상의 항목을 선택해주세요'),
  
  executedDate: z
    .string()
    .refine(isValidDate, '유효한 날짜 형식이 아닙니다')
    .default(() => new Date().toISOString().split('T')[0]),
  
  executedTime: z
    .string()
    .refine(isValidTime, '유효한 시간 형식이 아닙니다 (HH:MM)')
    .optional(),
})

// Search/Filter validation
export const ExecutionFilterSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  status: ExecutionStatusSchema.optional(),
  dateRange: z.object({
    start: z.string().refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
    end: z.string().refine(isValidDate, '유효한 날짜 형식이 아닙니다'),
  }).optional(),
  executedBy: z.string().uuid().optional(),
})

// Today checklist filter
export const TodayChecklistFilterSchema = z.object({
  department: z.string().optional(),
  itemCategory: z.string().optional(),
  status: ExecutionStatusSchema.optional(),
  assignedNurseId: z.string().uuid().optional(),
})

// Type exports
export type ExecutionCreateInput = z.infer<typeof ExecutionCreateSchema>
export type ExecutionUpdateInput = z.infer<typeof ExecutionUpdateSchema>
export type ExecutionCompleteInput = z.infer<typeof ExecutionCompleteSchema>
export type ExecutionSkipInput = z.infer<typeof ExecutionSkipSchema>
export type BulkExecutionCompleteInput = z.infer<typeof BulkExecutionCompleteSchema>
export type ExecutionFilter = z.infer<typeof ExecutionFilterSchema>
export type TodayChecklistFilter = z.infer<typeof TodayChecklistFilterSchema>

// Validation helper functions
export const validateExecutionCreate = (data: unknown) => {
  return ExecutionCreateSchema.safeParse(data)
}

export const validateExecutionUpdate = (data: unknown) => {
  return ExecutionUpdateSchema.safeParse(data)
}

export const validateExecutionComplete = (data: unknown) => {
  return ExecutionCompleteSchema.safeParse(data)
}

export const validateExecutionSkip = (data: unknown) => {
  return ExecutionSkipSchema.safeParse(data)
}

export const validateBulkExecutionComplete = (data: unknown) => {
  return BulkExecutionCompleteSchema.safeParse(data)
}

export const validateExecutionFilter = (data: unknown) => {
  return ExecutionFilterSchema.safeParse(data)
}

export const validateTodayChecklistFilter = (data: unknown) => {
  return TodayChecklistFilterSchema.safeParse(data)
}