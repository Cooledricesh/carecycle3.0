import { describe, it, expect } from 'vitest'
import {
  ScheduleCreateWithCustomItemSchema,
  type ScheduleCreateWithCustomItemInput
} from '../schedule'

describe('ScheduleCreateWithCustomItemSchema - injection_dosage field', () => {
  const baseValidInput = {
    patientId: '123e4567-e89b-12d3-a456-426614174000',
    itemName: '인플루엔자 백신',
    intervalWeeks: 52,
    intervalUnit: 'year' as const,
    intervalValue: 1,
    startDate: '2025-01-15',
    nextDueDate: '2026-01-15',
    category: 'injection' as const,
    notificationDaysBefore: 7
  }

  describe('injectionDosage 필드 정의 테스트', () => {
    it('should accept valid injection dosage as number', () => {
      const input: ScheduleCreateWithCustomItemInput = {
        ...baseValidInput,
        injectionDosage: 150
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.injectionDosage).toBe(150)
      }
    })

    it('should accept null injection dosage', () => {
      const input = {
        ...baseValidInput,
        injectionDosage: null
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.injectionDosage).toBeNull()
      }
    })

    it('should accept undefined injection dosage (optional)', () => {
      const input = {
        ...baseValidInput
        // injectionDosage 생략
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.injectionDosage).toBeUndefined()
      }
    })

    it('should reject negative injection dosage', () => {
      const input = {
        ...baseValidInput,
        injectionDosage: -10
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('양수')
      }
    })

    it('should reject zero injection dosage', () => {
      const input = {
        ...baseValidInput,
        injectionDosage: 0
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('양수')
      }
    })
  })

  describe('notes 필드 레거시 포맷 제거 확인', () => {
    it('should NOT contain injection dosage in notes field', () => {
      const input: ScheduleCreateWithCustomItemInput = {
        ...baseValidInput,
        notes: '환자에게 알레르기 확인 필요',
        injectionDosage: 150
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        // notes에 레거시 포맷이 없어야 함
        expect(result.data.notes).not.toContain('[용량]')
        expect(result.data.notes).not.toContain('용량:')
        expect(result.data.notes).toBe('환자에게 알레르기 확인 필요')

        // 용량은 별도 필드에 저장
        expect(result.data.injectionDosage).toBe(150)
      }
    })
  })

  describe('기존 카테고리(test, other) 정상 작동 확인', () => {
    it('should work for test category without injection dosage', () => {
      const input = {
        ...baseValidInput,
        itemName: '혈액검사',
        category: 'test' as const
        // injectionDosage 없음
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('should work for other category without injection dosage', () => {
      const input = {
        ...baseValidInput,
        itemName: '정기 검진',
        category: 'other' as const
        // injectionDosage 없음
      }

      const result = ScheduleCreateWithCustomItemSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })
})
