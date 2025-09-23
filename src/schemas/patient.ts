'use client'

import { z } from 'zod'

// 환자번호 검증 규칙
const patientNumberRegex = /^[A-Z0-9]{1,50}$/

// 진료구분 enum
export const CareTypeEnum = z.enum(['외래', '입원', '낮병원'])
export type CareType = z.infer<typeof CareTypeEnum>

// Base validation schemas
export const PatientCreateSchema = z.object({
  patientNumber: z
    .string()
    .min(1, '환자번호를 입력해주세요')
    .max(50, '환자번호는 50자 이내로 입력해주세요')
    .regex(patientNumberRegex, '환자번호는 영문 대문자와 숫자만 입력 가능합니다'),
  
  name: z
    .string()
    .min(1, '환자명을 입력해주세요')
    .max(100, '환자명은 100자 이내로 입력해주세요')
    .regex(/^[가-힣a-zA-Z\s]+$/, '환자명은 한글, 영문, 공백만 입력 가능합니다'),
  
  department: z
    .string()
    .max(50, '부서명은 50자 이내로 입력해주세요')
    .nullable()
    .optional(),
  
  careType: CareTypeEnum
    .nullable()
    .optional(),

  doctorId: z
    .string()
    .uuid('올바른 의사 ID를 선택해주세요')
    .nullable()
    .optional(),

  isActive: z
    .boolean()
    .default(true),
  
  metadata: z
    .record(z.any())
    .optional(),
})

export const PatientUpdateSchema = PatientCreateSchema.partial()

// Search/Filter validation
export const PatientFilterSchema = z.object({
  department: z.string().optional(),
  careType: CareTypeEnum.optional(),
  isActive: z.boolean().optional(),
  searchTerm: z
    .string()
    .max(100, '검색어는 100자 이내로 입력해주세요')
    .optional(),
})

// Bulk import validation
export const PatientImportRowSchema = z.object({
  patientNumber: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  department: z.string().nullable().optional(),
})

export const PatientImportSchema = z.object({
  patients: z
    .array(PatientImportRowSchema)
    .min(1, '최소 1명 이상의 환자 정보가 필요합니다')
    .max(1000, '한 번에 최대 1000명까지 등록 가능합니다'),
})

// Type exports
export type PatientCreateInput = z.infer<typeof PatientCreateSchema>
export type PatientUpdateInput = z.infer<typeof PatientUpdateSchema>
export type PatientFilter = z.infer<typeof PatientFilterSchema>
export type PatientImportRow = z.infer<typeof PatientImportRowSchema>
export type PatientImport = z.infer<typeof PatientImportSchema>

// Validation helper functions
export const validatePatientCreate = (data: unknown) => {
  return PatientCreateSchema.safeParse(data)
}

export const validatePatientUpdate = (data: unknown) => {
  return PatientUpdateSchema.safeParse(data)
}

export const validatePatientFilter = (data: unknown) => {
  return PatientFilterSchema.safeParse(data)
}

export const validatePatientImport = (data: unknown) => {
  return PatientImportSchema.safeParse(data)
}