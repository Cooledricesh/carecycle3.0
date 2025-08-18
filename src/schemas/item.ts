'use client'

import { z } from 'zod'
import { ItemCategory } from '@/types/database.types'

// Item categories
export const ItemCategorySchema = z.enum(['검사', '주사', '처치', '기타'])

// Base validation schemas
export const ItemCreateSchema = z.object({
  code: z
    .string()
    .min(1, '항목 코드를 입력해주세요')
    .max(20, '항목 코드는 20자 이내로 입력해주세요')
    .regex(/^[A-Z0-9]+$/, '항목 코드는 영문 대문자와 숫자만 입력 가능합니다'),
  
  name: z
    .string()
    .min(1, '항목명을 입력해주세요')
    .max(100, '항목명은 100자 이내로 입력해주세요'),
  
  category: ItemCategorySchema,
  
  defaultIntervalDays: z
    .number()
    .int('정수를 입력해주세요')
    .min(1, '최소 1일 이상 입력해주세요')
    .max(365, '최대 365일까지 입력 가능합니다')
    .default(28),
  
  description: z
    .string()
    .max(500, '설명은 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  instructions: z
    .string()
    .max(1000, '시행 지침은 1000자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  preparationNotes: z
    .string()
    .max(500, '준비사항은 500자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  requiresNotification: z
    .boolean()
    .default(false),
  
  notificationDaysBefore: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '0일 이상 입력해주세요')
    .max(30, '최대 30일까지 입력 가능합니다')
    .default(7),
  
  isActive: z
    .boolean()
    .default(true),
  
  sortOrder: z
    .number()
    .int('정수를 입력해주세요')
    .min(0, '0 이상 입력해주세요')
    .default(0),
})

export const ItemUpdateSchema = ItemCreateSchema.partial()

// Search/Filter validation
export const ItemFilterSchema = z.object({
  category: ItemCategorySchema.optional(),
  isActive: z.boolean().optional(),
  requiresNotification: z.boolean().optional(),
  searchTerm: z
    .string()
    .max(100, '검색어는 100자 이내로 입력해주세요')
    .optional(),
})

// Bulk operations
export const ItemBulkUpdateSchema = z.object({
  itemIds: z
    .array(z.string().uuid('유효한 항목 ID가 아닙니다'))
    .min(1, '최소 1개 이상의 항목을 선택해주세요'),
  updates: ItemUpdateSchema,
})

// Type exports
export type ItemCreateInput = z.infer<typeof ItemCreateSchema>
export type ItemUpdateInput = z.infer<typeof ItemUpdateSchema>
export type ItemFilter = z.infer<typeof ItemFilterSchema>
export type ItemBulkUpdate = z.infer<typeof ItemBulkUpdateSchema>

// Validation helper functions
export const validateItemCreate = (data: unknown) => {
  return ItemCreateSchema.safeParse(data)
}

export const validateItemUpdate = (data: unknown) => {
  return ItemUpdateSchema.safeParse(data)
}

export const validateItemFilter = (data: unknown) => {
  return ItemFilterSchema.safeParse(data)
}

export const validateItemBulkUpdate = (data: unknown) => {
  return ItemBulkUpdateSchema.safeParse(data)
}

// Common interval validation
export const CommonIntervalSchema = z
  .number()
  .int('정수를 입력해주세요')
  .refine(
    (val) => [7, 14, 28, 56, 84, 168].includes(val),
    '일반적인 주기를 선택해주세요 (1주, 2주, 4주, 8주, 12주, 24주)'
  )