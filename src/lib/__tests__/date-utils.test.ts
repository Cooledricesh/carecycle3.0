import { describe, test, expect } from 'vitest'
import {
  addMonths,
  calculateNextDueDate,
  formatDateForDB,
  parseDateFromDB,
  isFutureOrToday
} from '../date-utils'

/**
 * Date utilities test suite - focused on business logic
 *
 * Note: Trivial wrapper functions (addDays, addWeeks, getDaysBetween) are not tested
 * as they delegate to simple built-in Date methods. We test only functions with
 * complex logic or edge cases that matter for medical scheduling.
 */
describe('Date Utilities', () => {
  describe('addMonths', () => {
    test('should handle month-end dates correctly (Jan 31 -> Feb 28/29)', () => {
      const jan31 = new Date('2025-01-31')
      const result = addMonths(jan31, 1)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(28) // Feb 28, 2025 (not leap year)
    })

    test('should handle leap year edge case', () => {
      const jan31 = new Date('2024-01-31')
      const result = addMonths(jan31, 1)
      expect(result.getDate()).toBe(29) // Feb 29, 2024 (leap year)
    })
  })

  describe('calculateNextDueDate', () => {
    test('should calculate next due date for all interval types', () => {
      const date = new Date('2025-01-15')

      const dayResult = calculateNextDueDate(date, 'day', 7)
      expect(dayResult.getDate()).toBe(22)

      const weekResult = calculateNextDueDate(date, 'week', 2)
      expect(weekResult.getDate()).toBe(29)

      const monthResult = calculateNextDueDate(date, 'month', 3)
      expect(monthResult.getMonth()).toBe(3) // April
    })

    test('should throw error for invalid interval unit', () => {
      const date = new Date('2025-01-15')
      expect(() => {
        // @ts-expect-error Testing invalid input
        calculateNextDueDate(date, 'invalid', 1)
      }).toThrow('Invalid interval unit')
    })
  })

  describe('formatDateForDB / parseDateFromDB', () => {
    test('should format and parse dates consistently', () => {
      const date = new Date('2025-03-05')
      const formatted = formatDateForDB(date)
      expect(formatted).toBe('2025-03-05')

      const parsed = parseDateFromDB(formatted)
      expect(parsed.getUTCFullYear()).toBe(2025)
      expect(parsed.getUTCMonth()).toBe(2) // March
      expect(parsed.getUTCDate()).toBe(5)
    })

    test('should parse as UTC to avoid timezone issues', () => {
      const result = parseDateFromDB('2025-06-15')
      expect(result.getUTCHours()).toBe(0)
      expect(result.getUTCMinutes()).toBe(0)
    })
  })

  describe('isFutureOrToday', () => {
    test('should correctly identify past, present, and future', () => {
      const past = new Date()
      past.setDate(past.getDate() - 1)
      expect(isFutureOrToday(past)).toBe(false)

      const today = new Date()
      expect(isFutureOrToday(today)).toBe(true)

      const future = new Date()
      future.setDate(future.getDate() + 1)
      expect(isFutureOrToday(future)).toBe(true)
    })

    test('should ignore time component', () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      expect(isFutureOrToday(today)).toBe(true)
    })
  })
})
