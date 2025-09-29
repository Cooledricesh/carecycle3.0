'use client'

import { z } from 'zod'

/**
 * Schema for creating a new schedule with custom interval units
 * This schema is specifically for the T-022 task requirements
 */
export const ScheduleCreateWithIntervalSchema = z.object({
  patientId: z
    .string()
    .uuid('유효한 환자 ID가 아닙니다')
    .min(1, '환자를 선택해주세요'),
  
  itemName: z
    .string()
    .min(1, '검사/주사명을 입력해주세요')
    .max(80, '검사/주사명은 80자 이내로 입력해주세요'),
  
  intervalUnit: z
    .enum(['week'], {
      required_error: '반복 단위를 선택해주세요',
      invalid_type_error: '유효한 반복 단위가 아닙니다'
    }),
  
  intervalValue: z
    .number({
      required_error: '반복 주기를 입력해주세요',
      invalid_type_error: '숫자를 입력해주세요'
    })
    .int('정수를 입력해주세요')
    .min(1, '최소 1 이상 입력해주세요')
    .max(365, '최대 365까지 입력 가능합니다'),
  
  firstPerformedAt: z
    .date({
      required_error: '최초 시행일을 선택해주세요',
      invalid_type_error: '유효한 날짜가 아닙니다'
    })
    .or(z.string().transform(str => new Date(str))),
  
  notes: z
    .string()
    .max(500, '메모는 500자 이내로 입력해주세요')
    .optional()
    .nullable(),

  category: z
    .enum(['test', 'injection', 'procedure', 'other'], {
      required_error: '카테고리를 선택해주세요',
      invalid_type_error: '유효한 카테고리가 아닙니다'
    })
    .default('other'),

  notificationDaysBefore: z
    .number({
      required_error: '알림 일수를 입력해주세요',
      invalid_type_error: '숫자를 입력해주세요'
    })
    .int('정수를 입력해주세요')
    .min(0, '최소 0 이상 입력해주세요')
    .max(30, '최대 30일까지 입력 가능합니다')
    .default(7),
})

export type ScheduleCreateWithIntervalInput = z.infer<typeof ScheduleCreateWithIntervalSchema>

/**
 * Validation helper function
 */
export const validateScheduleCreateWithInterval = (data: unknown) => {
  return ScheduleCreateWithIntervalSchema.safeParse(data)
}