import { describe, test, expect } from 'vitest'
import {
  addDays,
  addWeeks,
  addMonths,
  calculateNextDueDate,
  formatDateForDB,
  parseDateFromDB,
  isFutureOrToday,
  getDaysBetween
} from '../date-utils'

describe('Date Utilities', () => {
  describe('addDays', () => {
    test('should add positive days correctly', () => {
      const date = new Date('2025-01-15')
      const result = addDays(date, 5)
      expect(result.getDate()).toBe(20)
      expect(result.getMonth()).toBe(0) // January
    })

    test('should handle month transition', () => {
      const date = new Date('2025-01-30')
      const result = addDays(date, 5)
      expect(result.getDate()).toBe(4)
      expect(result.getMonth()).toBe(1) // February
    })

    test('should subtract days when negative', () => {
      const date = new Date('2025-01-15')
      const result = addDays(date, -5)
      expect(result.getDate()).toBe(10)
    })

    test('should not mutate original date', () => {
      const date = new Date('2025-01-15')
      const original = date.getDate()
      addDays(date, 5)
      expect(date.getDate()).toBe(original)
    })
  })

  describe('addWeeks', () => {
    test('should add weeks correctly', () => {
      const date = new Date('2025-01-15')
      const result = addWeeks(date, 2)
      expect(result.getDate()).toBe(29)
    })

    test('should handle multiple weeks across months', () => {
      const date = new Date('2025-01-20')
      const result = addWeeks(date, 4)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(17)
    })
  })

  describe('addMonths', () => {
    test('should add months correctly', () => {
      const date = new Date('2025-01-15')
      const result = addMonths(date, 2)
      expect(result.getMonth()).toBe(2) // March
      expect(result.getDate()).toBe(15)
    })

    test('should handle month-end dates (Jan 31 -> Feb 28)', () => {
      const date = new Date('2025-01-31')
      const result = addMonths(date, 1)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(28) // Feb 28, 2025 (not leap year)
    })

    test('should handle leap year (Jan 31 -> Feb 29)', () => {
      const date = new Date('2024-01-31')
      const result = addMonths(date, 1)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(29) // Feb 29, 2024 (leap year)
    })

    test('should handle year transition', () => {
      const date = new Date('2025-11-15')
      const result = addMonths(date, 3)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(1) // February
    })
  })

  describe('calculateNextDueDate', () => {
    test('should calculate next due date for days', () => {
      const date = new Date('2025-01-15')
      const result = calculateNextDueDate(date, 'day', 7)
      expect(result.getDate()).toBe(22)
    })

    test('should calculate next due date for weeks', () => {
      const date = new Date('2025-01-15')
      const result = calculateNextDueDate(date, 'week', 2)
      expect(result.getDate()).toBe(29)
    })

    test('should calculate next due date for months', () => {
      const date = new Date('2025-01-15')
      const result = calculateNextDueDate(date, 'month', 3)
      expect(result.getMonth()).toBe(3) // April
    })

    test('should throw error for invalid interval unit', () => {
      const date = new Date('2025-01-15')
      expect(() => {
        // @ts-expect-error Testing invalid input
        calculateNextDueDate(date, 'invalid', 1)
      }).toThrow('Invalid interval unit')
    })
  })

  describe('formatDateForDB', () => {
    test('should format date correctly', () => {
      const date = new Date('2025-01-15')
      const result = formatDateForDB(date)
      expect(result).toBe('2025-01-15')
    })

    test('should pad single digit months and days', () => {
      const date = new Date('2025-03-05')
      const result = formatDateForDB(date)
      expect(result).toBe('2025-03-05')
    })

    test('should handle year transitions', () => {
      const date = new Date('2024-12-31')
      const result = formatDateForDB(date)
      expect(result).toBe('2024-12-31')
    })
  })

  describe('parseDateFromDB', () => {
    test('should parse date string correctly', () => {
      const result = parseDateFromDB('2025-01-15')
      expect(result.getUTCFullYear()).toBe(2025)
      expect(result.getUTCMonth()).toBe(0) // January
      expect(result.getUTCDate()).toBe(15)
    })

    test('should parse as UTC to avoid timezone issues', () => {
      const result = parseDateFromDB('2025-06-15')
      expect(result.getUTCHours()).toBe(0)
      expect(result.getUTCMinutes()).toBe(0)
    })
  })

  describe('isFutureOrToday', () => {
    test('should return true for today', () => {
      const today = new Date()
      expect(isFutureOrToday(today)).toBe(true)
    })

    test('should return true for future dates', () => {
      const future = new Date()
      future.setDate(future.getDate() + 1)
      expect(isFutureOrToday(future)).toBe(true)
    })

    test('should return false for past dates', () => {
      const past = new Date()
      past.setDate(past.getDate() - 1)
      expect(isFutureOrToday(past)).toBe(false)
    })

    test('should ignore time component', () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      expect(isFutureOrToday(today)).toBe(true)
    })
  })

  describe('getDaysBetween', () => {
    test('should calculate days between dates correctly', () => {
      const date1 = new Date('2025-01-15')
      const date2 = new Date('2025-01-20')
      expect(getDaysBetween(date1, date2)).toBe(5)
    })

    test('should return absolute difference', () => {
      const date1 = new Date('2025-01-20')
      const date2 = new Date('2025-01-15')
      expect(getDaysBetween(date1, date2)).toBe(5)
    })

    test('should return 0 for same date', () => {
      const date = new Date('2025-01-15')
      expect(getDaysBetween(date, date)).toBe(0)
    })

    test('should handle dates across months', () => {
      const date1 = new Date('2025-01-25')
      const date2 = new Date('2025-02-05')
      expect(getDaysBetween(date1, date2)).toBe(11)
    })
  })
})
