import { describe, test, expect, beforeEach } from 'vitest'
import { ScheduleDateCalculator } from '../schedule-date-calculator'
import type { Schedule } from '@/types/schedule'
import { addWeeks, subWeeks, addDays } from 'date-fns'

describe('ScheduleDateCalculator', () => {
  let calculator: ScheduleDateCalculator
  let mockSchedule: Schedule

  beforeEach(() => {
    calculator = new ScheduleDateCalculator()

    // Create a base mock schedule
    mockSchedule = {
      id: 'test-schedule-id',
      patientId: 'test-patient-id',
      itemId: 'test-item-id',
      intervalWeeks: 2,
      startDate: '2025-01-01',
      nextDueDate: '2025-01-15',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    } as Schedule
  })

  describe('calculateNextDueDate', () => {
    test('should calculate immediate resume correctly', () => {
      const result = calculator.calculateNextDueDate(mockSchedule, {
        strategy: 'immediate'
      })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      expect(result.getTime()).toBeGreaterThanOrEqual(today.getTime())
    })

    test('should calculate next cycle resume correctly', () => {
      const result = calculator.calculateNextDueDate(mockSchedule, {
        strategy: 'next_cycle'
      })

      const today = new Date()
      const expectedDate = addWeeks(today, mockSchedule.intervalWeeks || 1)
      expectedDate.setHours(0, 0, 0, 0)

      expect(result.getDate()).toBe(expectedDate.getDate())
    })

    test('should use custom date when provided', () => {
      const customDate = new Date('2025-02-15')
      const result = calculator.calculateNextDueDate(mockSchedule, {
        strategy: 'custom',
        customDate
      })

      expect(result.getDate()).toBe(15)
      expect(result.getMonth()).toBe(1) // February
    })

    test('should throw error for custom strategy without customDate', () => {
      expect(() => {
        calculator.calculateNextDueDate(mockSchedule, {
          strategy: 'custom'
        })
      }).toThrow('Custom strategy requires customDate')
    })

    test('should return a valid date for immediate strategy with future start date', () => {
      const futureStartDate = addDays(new Date(), 10)
      mockSchedule.startDate = futureStartDate.toISOString().split('T')[0]

      const result = calculator.calculateNextDueDate(mockSchedule, {
        strategy: 'immediate'
      })

      // Should return a valid date (either today or start date)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBeGreaterThan(0)
    })
  })

  describe('getMissedExecutions', () => {
    test('should calculate missed executions during pause', () => {
      const pausedDate = new Date('2025-01-15')
      const resumeDate = new Date('2025-02-15')
      mockSchedule.nextDueDate = '2025-01-15'

      const result = calculator.getMissedExecutions(
        mockSchedule,
        pausedDate,
        resumeDate
      )

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('date')
      expect(result[0]).toHaveProperty('weeksOverdue')
    })

    test('should return empty array when no executions missed', () => {
      const pausedDate = new Date('2025-01-15')
      const resumeDate = new Date('2025-01-16') // Only 1 day pause
      mockSchedule.nextDueDate = '2025-01-20' // Next due is after resume

      const result = calculator.getMissedExecutions(
        mockSchedule,
        pausedDate,
        resumeDate
      )

      expect(result.length).toBe(0)
    })

    test('should calculate correct weeks overdue', () => {
      const pausedDate = new Date('2025-01-01')
      const resumeDate = addWeeks(pausedDate, 8) // 8 weeks pause
      mockSchedule.nextDueDate = '2025-01-01'
      mockSchedule.intervalWeeks = 2

      const result = calculator.getMissedExecutions(
        mockSchedule,
        pausedDate,
        resumeDate
      )

      expect(result.length).toBeGreaterThan(0)
      result.forEach(missed => {
        expect(missed.weeksOverdue).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('calculateCatchUpDates', () => {
    test('should return empty array for zero missed count', () => {
      const result = calculator.calculateCatchUpDates(mockSchedule, 0)
      expect(result).toEqual([])
    })

    test('should return empty array for negative missed count', () => {
      const result = calculator.calculateCatchUpDates(mockSchedule, -1)
      expect(result).toEqual([])
    })

    test('should calculate catch-up dates with compressed interval', () => {
      const missedCount = 4
      const result = calculator.calculateCatchUpDates(mockSchedule, missedCount)

      expect(result.length).toBe(missedCount)

      // Check dates are in the future or today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      result.forEach(date => {
        const dateWithoutTime = new Date(date)
        dateWithoutTime.setHours(0, 0, 0, 0)
        expect(dateWithoutTime.getTime()).toBeGreaterThanOrEqual(today.getTime())
      })
    })

    test('should respect schedule end date', () => {
      const endDate = addWeeks(new Date(), 2)
      mockSchedule.endDate = endDate.toISOString().split('T')[0]

      const result = calculator.calculateCatchUpDates(mockSchedule, 10)

      // Should filter out dates after end date
      result.forEach(date => {
        expect(date.getTime()).toBeLessThanOrEqual(endDate.getTime())
      })
    })

    test('should use compressed interval (half of original)', () => {
      mockSchedule.intervalWeeks = 4
      const result = calculator.calculateCatchUpDates(mockSchedule, 2)

      expect(result.length).toBe(2)

      // Interval should be compressed (2 weeks instead of 4)
      if (result.length === 2) {
        const daysDiff = (result[1].getTime() - result[0].getTime()) / (1000 * 60 * 60 * 24)
        const weeksDiff = Math.round(daysDiff / 7)
        expect(weeksDiff).toBe(2) // Half of 4 weeks
      }
    })
  })

  describe('getRemainingExecutions', () => {
    test('should return null for schedules without end date', () => {
      mockSchedule.endDate = undefined
      const result = calculator.getRemainingExecutions(mockSchedule)
      expect(result).toBeNull()
    })

    test('should return 0 when current date is after end date', () => {
      const pastDate = subWeeks(new Date(), 10)
      mockSchedule.endDate = pastDate.toISOString().split('T')[0]

      const result = calculator.getRemainingExecutions(mockSchedule)
      expect(result).toBe(0)
    })

    test('should calculate remaining executions correctly', () => {
      const futureDate = addWeeks(new Date(), 10)
      mockSchedule.endDate = futureDate.toISOString().split('T')[0]
      mockSchedule.intervalWeeks = 2

      const result = calculator.getRemainingExecutions(mockSchedule)

      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThanOrEqual(6) // Approximately 5 executions
    })

    test('should accept custom fromDate', () => {
      const startDate = new Date('2025-01-01')
      const endDate = new Date('2025-03-01')
      mockSchedule.endDate = endDate.toISOString().split('T')[0]
      mockSchedule.intervalWeeks = 2

      const result = calculator.getRemainingExecutions(mockSchedule, startDate)

      expect(result).toBeGreaterThan(0)
    })
  })

  describe('validateNextDueDate', () => {
    test('should reject past dates', () => {
      const pastDate = subWeeks(new Date(), 1)
      const result = calculator.validateNextDueDate(mockSchedule, pastDate)

      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('과거')
    })

    test('should reject dates before start date', () => {
      // Use future dates to avoid past date check
      const futureStartDate = addWeeks(new Date(), 8)
      mockSchedule.startDate = futureStartDate.toISOString().split('T')[0]
      const testDate = addWeeks(new Date(), 4) // Before start date but in future

      const result = calculator.validateNextDueDate(mockSchedule, testDate)

      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('시작일')
    })

    test('should reject dates after end date', () => {
      // Use future dates
      const futureEndDate = addWeeks(new Date(), 4)
      mockSchedule.endDate = futureEndDate.toISOString().split('T')[0]
      const testDate = addWeeks(new Date(), 8) // After end date

      const result = calculator.validateNextDueDate(mockSchedule, testDate)

      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('종료일')
    })

    test('should reject dates too close to last execution', () => {
      const lastExecuted = new Date()
      mockSchedule.lastExecutedDate = lastExecuted.toISOString().split('T')[0]

      const tooSoon = addDays(lastExecuted, 3) // Less than 1 week
      const result = calculator.validateNextDueDate(mockSchedule, tooSoon)

      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('1주 간격')
    })

    test('should accept valid future dates', () => {
      const validDate = addWeeks(new Date(), 2)
      const result = calculator.validateNextDueDate(mockSchedule, validDate)

      expect(result.isValid).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('suggestResumeStrategy', () => {
    test('should suggest immediate for short pause', () => {
      mockSchedule.intervalWeeks = 4
      const pauseDuration = 2 // Less than interval

      const result = calculator.suggestResumeStrategy(mockSchedule, pauseDuration)

      expect(result).toBe('immediate')
    })

    test('should suggest next_cycle for long pause', () => {
      mockSchedule.intervalWeeks = 2
      const pauseDuration = 10 // More than 4 intervals (8 weeks)

      const result = calculator.suggestResumeStrategy(mockSchedule, pauseDuration)

      expect(result).toBe('next_cycle')
    })

    test('should suggest custom for medium pause', () => {
      mockSchedule.intervalWeeks = 2
      const pauseDuration = 4 // Between 1 and 4 intervals

      const result = calculator.suggestResumeStrategy(mockSchedule, pauseDuration)

      expect(result).toBe('custom')
    })

    test('should handle edge case at interval boundary', () => {
      mockSchedule.intervalWeeks = 3
      const pauseDuration = 3 // Exactly one interval

      const result = calculator.suggestResumeStrategy(mockSchedule, pauseDuration)

      expect(['immediate', 'custom']).toContain(result)
    })
  })
})
