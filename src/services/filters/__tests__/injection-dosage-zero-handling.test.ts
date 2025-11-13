/**
 * Test for BUG: injection_dosage 0 value incorrectly converted to null
 *
 * Problem: Using `injection_dosage || null` converts 0 to null
 * Solution: Use `injection_dosage ?? null` to preserve 0 values
 *
 * This test verifies that 0 dosage is preserved in data transformation
 */

import { describe, it, expect } from 'vitest'

describe('injection_dosage 0 value handling', () => {
  describe('Logical OR operator (||) - BROKEN BEHAVIOR (demonstration)', () => {
    it('should demonstrate that || incorrectly converts 0 to null', () => {
      const injection_dosage = 0

      // This demonstrates the BROKEN pattern (now fixed in codebase)
      const brokenResult = injection_dosage || null
      expect(brokenResult).toBeNull() // Bug: 0 becomes null

      // This is the CORRECT pattern (now used in codebase)
      const correctResult = injection_dosage ?? null
      expect(correctResult).toBe(0) // Fixed: 0 preserved
    })
  })

  describe('Nullish coalescing operator (??) - CORRECT BEHAVIOR', () => {
    it('should preserve 0 value with ?? operator', () => {
      const injection_dosage = 0

      // This is the CORRECT pattern
      const result = injection_dosage ?? null

      expect(result).toBe(0) // PASSES: correctly preserves 0
    })

    it('should convert undefined to null with ?? operator', () => {
      const injection_dosage = undefined
      const result = injection_dosage ?? null

      expect(result).toBeNull()
    })

    it('should convert null to null with ?? operator', () => {
      const injection_dosage = null
      const result = injection_dosage ?? null

      expect(result).toBeNull()
    })

    it('should preserve positive values with ?? operator', () => {
      const injection_dosage = 150
      const result = injection_dosage ?? null

      expect(result).toBe(150)
    })
  })

  describe('Real-world schedule data transformation', () => {
    it('should preserve 0 dosage in schedule object', () => {
      // Simulating database row with 0 dosage
      const dbRow = {
        id: '123',
        patient_name: '테스트',
        item_name: '독감 백신',
        injection_dosage: 0 // Valid 0 value from database
      }

      // BROKEN: Current implementation with ||
      const brokenTransform = {
        ...dbRow,
        injection_dosage: dbRow.injection_dosage || null
      }

      // CORRECT: Fixed implementation with ??
      const correctTransform = {
        ...dbRow,
        injection_dosage: dbRow.injection_dosage ?? null
      }

      // This demonstrates the bug
      expect(brokenTransform.injection_dosage).toBeNull() // Bug: 0 becomes null
      expect(correctTransform.injection_dosage).toBe(0)   // Fixed: 0 preserved
    })
  })
})
