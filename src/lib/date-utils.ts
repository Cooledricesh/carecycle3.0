'use client'

/**
 * Adds days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Adds weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

/**
 * Adds months to a date
 * Handles month-end dates properly (e.g., Jan 31 + 1 month = Feb 28/29)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const targetMonth = result.getMonth() + months
  const targetDate = result.getDate()
  
  // Set to the target month
  result.setMonth(targetMonth)
  
  // Handle month-end overflow
  // If the date changed (e.g., Jan 31 -> Mar 3), it means we overflowed
  // In that case, set to the last day of the previous month
  if (result.getDate() !== targetDate) {
    result.setDate(0) // Sets to last day of previous month
  }
  
  return result
}

/**
 * Calculates the next due date based on interval unit and value
 */
export function calculateNextDueDate(
  firstPerformedAt: Date,
  intervalUnit: 'day' | 'week' | 'month',
  intervalValue: number
): Date {
  switch (intervalUnit) {
    case 'day':
      return addDays(firstPerformedAt, intervalValue)
    case 'week':
      return addWeeks(firstPerformedAt, intervalValue)
    case 'month':
      return addMonths(firstPerformedAt, intervalValue)
    default:
      throw new Error(`Invalid interval unit: ${intervalUnit}`)
  }
}

/**
 * Formats a date to YYYY-MM-DD string for database storage
 */
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a date string from database (YYYY-MM-DD) to Date object
 */
export function parseDateFromDB(dateString: string): Date {
  // Parse as UTC to avoid timezone issues
  return new Date(dateString + 'T00:00:00.000Z')
}

/**
 * Checks if a date is today or in the future
 */
export function isFutureOrToday(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate >= today
}

/**
 * Gets the number of days between two dates
 */
export function getDaysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000 // milliseconds in a day
  const diffMs = Math.abs(date2.getTime() - date1.getTime())
  return Math.floor(diffMs / oneDay)
}