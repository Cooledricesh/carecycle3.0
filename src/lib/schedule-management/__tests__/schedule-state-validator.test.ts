import { describe, it, expect, beforeEach } from 'vitest'
import { ScheduleStateValidator } from '../schedule-state-validator'
import type { Schedule } from '@/types/schedule'
import type { ScheduleStatus } from '@/lib/database.types'

describe('ScheduleStateValidator', () => {
  let validator: ScheduleStateValidator

  beforeEach(() => {
    validator = new ScheduleStateValidator()
  })

  // Helper to create mock schedule
  const createMockSchedule = (overrides?: Partial<Schedule>): Schedule => ({
    id: 'schedule-1',
    patientId: 'patient-1',
    itemId: 'item-1',
    intervalWeeks: 2,
    startDate: '2025-01-01',
    nextDueDate: '2025-01-15',
    status: 'active',
    priority: 1,
    requiresNotification: false,
    notificationDaysBefore: 3,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides
  })

  describe('validateTransition', () => {
    describe('Active state transitions', () => {
      it('should allow active to paused transition', () => {
        const result = validator.validateTransition('active', 'paused')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.requiredActions).toContain('연관 데이터 동기화 필요')
        expect(result.warnings).toContain('예정된 실행과 알림이 취소됩니다.')
      })

      it('should allow active to completed transition', () => {
        const result = validator.validateTransition('active', 'completed')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should allow active to cancelled transition', () => {
        const result = validator.validateTransition('active', 'cancelled')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.requiredActions).toContain('연관 데이터 동기화 필요')
      })
    })

    describe('Paused state transitions', () => {
      it('should allow paused to active transition', () => {
        const result = validator.validateTransition('paused', 'active')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.requiredActions).toContain('next_due_date 재계산 필요')
        expect(result.requiredActions).toContain('연관 데이터 동기화 필요')
        expect(result.warnings).toContain('일시정지 기간 동안의 실행이 누락될 수 있습니다.')
      })

      it('should allow paused to cancelled transition', () => {
        const result = validator.validateTransition('paused', 'cancelled')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject paused to completed transition', () => {
        const result = validator.validateTransition('paused', 'completed')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'paused'에서 'completed'로의 전환은 허용되지 않습니다.")
      })
    })

    describe('Completed state transitions', () => {
      it('should reject completed to active transition', () => {
        const result = validator.validateTransition('completed', 'active')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'completed'에서 'active'로의 전환은 허용되지 않습니다.")
      })

      it('should reject completed to paused transition', () => {
        const result = validator.validateTransition('completed', 'paused')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'completed'에서 'paused'로의 전환은 허용되지 않습니다.")
      })

      it('should reject completed to cancelled transition', () => {
        const result = validator.validateTransition('completed', 'cancelled')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'completed'에서 'cancelled'로의 전환은 허용되지 않습니다.")
      })
    })

    describe('Cancelled state transitions', () => {
      it('should reject cancelled to active transition', () => {
        const result = validator.validateTransition('cancelled', 'active')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'cancelled'에서 'active'로의 전환은 허용되지 않습니다.")
      })

      it('should reject cancelled to paused transition', () => {
        const result = validator.validateTransition('cancelled', 'paused')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'cancelled'에서 'paused'로의 전환은 허용되지 않습니다.")
      })

      it('should reject cancelled to completed transition', () => {
        const result = validator.validateTransition('cancelled', 'completed')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("'cancelled'에서 'completed'로의 전환은 허용되지 않습니다.")
      })
    })

    describe('Same state transitions', () => {
      it('should allow same state transition with warning', () => {
        const result = validator.validateTransition('active', 'active')

        expect(result.isValid).toBe(true)
        expect(result.warnings).toContain('상태가 변경되지 않습니다.')
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('Undefined state transitions', () => {
      it('should reject undefined state transitions', () => {
        // @ts-expect-error Testing invalid state
        const result = validator.validateTransition('active', 'invalid')

        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('canPause', () => {
    it('should allow pausing active schedule', () => {
      const schedule = createMockSchedule({ status: 'active' })

      const canPause = validator.canPause(schedule)

      expect(canPause).toBe(true)
    })

    it('should reject pausing paused schedule', () => {
      const schedule = createMockSchedule({ status: 'paused' })

      const canPause = validator.canPause(schedule)

      expect(canPause).toBe(false)
    })

    it('should reject pausing completed schedule', () => {
      const schedule = createMockSchedule({ status: 'completed' })

      const canPause = validator.canPause(schedule)

      expect(canPause).toBe(false)
    })

    it('should reject pausing schedule that already ended', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const schedule = createMockSchedule({
        status: 'active',
        endDate: pastDate.toISOString().split('T')[0]
      })

      const canPause = validator.canPause(schedule)

      expect(canPause).toBe(false)
    })

    it('should allow pausing schedule with future end date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const schedule = createMockSchedule({
        status: 'active',
        endDate: futureDate.toISOString().split('T')[0]
      })

      const canPause = validator.canPause(schedule)

      expect(canPause).toBe(true)
    })
  })

  describe('canResume', () => {
    it('should allow resuming paused schedule', () => {
      const schedule = createMockSchedule({ status: 'paused' })

      const canResume = validator.canResume(schedule)

      expect(canResume).toBe(true)
    })

    it('should reject resuming active schedule', () => {
      const schedule = createMockSchedule({ status: 'active' })

      const canResume = validator.canResume(schedule)

      expect(canResume).toBe(false)
    })

    it('should reject resuming completed schedule', () => {
      const schedule = createMockSchedule({ status: 'completed' })

      const canResume = validator.canResume(schedule)

      expect(canResume).toBe(false)
    })

    it('should reject resuming schedule that already ended', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const schedule = createMockSchedule({
        status: 'paused',
        endDate: pastDate.toISOString().split('T')[0]
      })

      const canResume = validator.canResume(schedule)

      expect(canResume).toBe(false)
    })

    it('should allow resuming paused schedule with future end date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const schedule = createMockSchedule({
        status: 'paused',
        endDate: futureDate.toISOString().split('T')[0]
      })

      const canResume = validator.canResume(schedule)

      expect(canResume).toBe(true)
    })
  })

  describe('getBlockingReasons', () => {
    it('should return empty array for valid transitions', () => {
      const schedule = createMockSchedule({ status: 'active' })

      const reasons = validator.getBlockingReasons(schedule, 'paused')

      expect(reasons).toHaveLength(0)
    })

    it('should return transition errors for invalid transitions', () => {
      const schedule = createMockSchedule({ status: 'completed' })

      const reasons = validator.getBlockingReasons(schedule, 'active')

      expect(reasons.length).toBeGreaterThan(0)
      expect(reasons[0]).toContain('허용되지 않습니다')
    })

    it('should return reason for ended schedule', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const schedule = createMockSchedule({
        status: 'active',
        endDate: pastDate.toISOString().split('T')[0]
      })

      const reasons = validator.getBlockingReasons(schedule, 'paused')

      expect(reasons).toContain('종료된 스케줄은 상태를 변경할 수 없습니다.')
    })

    it('should include completion check for active to completed transition', () => {
      const schedule = createMockSchedule({ status: 'active' })

      const reasons = validator.getBlockingReasons(schedule, 'completed')

      expect(reasons).toContain('모든 실행이 완료되었는지 확인이 필요합니다.')
    })
  })

  describe('getRequiredActions', () => {
    it('should return required actions for active to paused transition', () => {
      const actions = validator.getRequiredActions('active', 'paused')

      expect(actions).toContain('연관 데이터 동기화 필요')
    })

    it('should return required actions for paused to active transition', () => {
      const actions = validator.getRequiredActions('paused', 'active')

      expect(actions).toContain('next_due_date 재계산 필요')
      expect(actions).toContain('연관 데이터 동기화 필요')
    })

    it('should return empty array for transitions with no required actions', () => {
      const actions = validator.getRequiredActions('active', 'completed')

      expect(actions).toHaveLength(0)
    })

    it('should return empty array for invalid transitions', () => {
      const actions = validator.getRequiredActions('completed', 'active')

      expect(actions).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle schedule without end date', () => {
      const schedule = createMockSchedule({
        status: 'active',
        endDate: undefined
      })

      expect(validator.canPause(schedule)).toBe(true)
      expect(validator.getBlockingReasons(schedule, 'paused')).toHaveLength(0)
    })

    it('should handle schedule with null end date', () => {
      const schedule = createMockSchedule({
        status: 'active',
        endDate: null as any
      })

      expect(validator.canPause(schedule)).toBe(true)
    })
  })
})
