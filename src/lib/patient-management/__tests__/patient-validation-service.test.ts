import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PatientValidationService } from '../patient-validation-service'
import type { SupabaseClient } from '@/lib/supabase/database'
import { patientRestoreManager } from '../patient-restore-manager'

// Mock patient restore manager
vi.mock('../patient-restore-manager', () => ({
  patientRestoreManager: {
    checkForInactivePatient: vi.fn()
  }
}))

// Mock Supabase client
const createMockSupabaseClient = () => {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
              limit: vi.fn()
            })),
            single: vi.fn(),
            limit: vi.fn()
          })),
          single: vi.fn(),
          limit: vi.fn()
        })),
        single: vi.fn(),
        limit: vi.fn()
      }))
    }))
  } as unknown as SupabaseClient
}

describe('PatientValidationService', () => {
  let service: PatientValidationService
  let mockSupabase: SupabaseClient

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    service = new PatientValidationService(mockSupabase)
  })

  describe('validatePatientNumber - Format Validation', () => {
    it('should reject empty patient number', async () => {
      const result = await service.validatePatientNumber('', { checkDuplicates: false })

      expect(result.isValid).toBe(false)
      expect(result.conflictDetails?.message).toContain('1-50자')
    })

    it('should reject patient number exceeding 50 characters', async () => {
      const longNumber = 'A'.repeat(51)
      const result = await service.validatePatientNumber(longNumber, { checkDuplicates: false })

      expect(result.isValid).toBe(false)
      expect(result.conflictDetails?.message).toContain('1-50자')
    })

    it('should reject patient number with lowercase letters', async () => {
      const result = await service.validatePatientNumber('abc123', { checkDuplicates: false })

      expect(result.isValid).toBe(false)
      expect(result.conflictDetails?.message).toContain('영문 대문자')
    })

    it('should reject patient number with special characters', async () => {
      const result = await service.validatePatientNumber('ABC-123', { checkDuplicates: false })

      expect(result.isValid).toBe(false)
      expect(result.conflictDetails?.message).toContain('영문 대문자')
    })

    it('should accept valid patient number with uppercase letters and numbers', async () => {
      const result = await service.validatePatientNumber('ABC123', { checkDuplicates: false })

      expect(result.isValid).toBe(true)
      expect(result.conflict).toBe('none')
    })

    it('should accept valid patient number with only numbers', async () => {
      const result = await service.validatePatientNumber('123456', { checkDuplicates: false })

      expect(result.isValid).toBe(true)
      expect(result.conflict).toBe('none')
    })

    it('should accept valid patient number with only uppercase letters', async () => {
      const result = await service.validatePatientNumber('ABCDEF', { checkDuplicates: false })

      expect(result.isValid).toBe(true)
      expect(result.conflict).toBe('none')
    })
  })

  describe('validatePatientNumber - Duplicate Check', () => {
    it('should detect active patient conflict', async () => {
      // Arrange: Mock active patient exists
      const mockEqChain = {
        single: vi.fn().mockResolvedValue({
          data: {
            id: '1',
            name: '테스트',
            patient_number: 'TEST001',
            care_type: '외래'
          },
          error: null
        }),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => mockEqChain)
            }))
          }))
        }))
      }))
      mockSupabase.from = mockFrom as any

      // Act
      const result = await service.validatePatientNumber('TEST001', {
        suggestAlternatives: false
      })

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.conflict).toBe('active_patient_exists')
      expect(result.conflictDetails?.canRestore).toBe(false)
      expect(result.conflictDetails?.canCreateNew).toBe(false)
    })

    it('should pass when no duplicate exists', async () => {
      // Arrange: Mock no patient exists (PGRST116 = no rows found)
      const mockEqChain = {
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => mockEqChain)
            }))
          }))
        }))
      }))
      mockSupabase.from = mockFrom as any

      // Mock no inactive patient found
      vi.mocked(patientRestoreManager.checkForInactivePatient).mockResolvedValue(null)

      // Act
      const result = await service.validatePatientNumber('NEW001')

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.conflict).toBe('none')
    })
  })

  describe('validatePatientNumber - Alternative Number Generation', () => {
    it('should generate alternative numbers when active patient exists', async () => {
      // Arrange: Mock active patient exists
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '1',
                    name: '테스트',
                    patient_number: 'TEST001',
                    care_type: '외래'
                  },
                  error: null
                }),
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              }))
            }))
          }))
        }))
      }))
      mockSupabase.from = mockFrom as any

      // Act
      const result = await service.validatePatientNumber('TEST001', {
        suggestAlternatives: true
      })

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions!.length).toBeGreaterThan(0)
    })
  })

  describe('validateRestorationEligibility', () => {
    it('should allow restoration of inactive patient with no conflicts', async () => {
      // Arrange: Mock inactive patient with original number available
      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '1',
                  patient_number: 'ARCHIVED_001',
                  name: '테스트',
                  is_active: false,
                  archived: true,
                  archived_at: new Date().toISOString(),
                  original_patient_number: 'TEST001',
                  created_at: new Date().toISOString()
                },
                error: null
              })
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                }))
              }))
            }))
          }))
        })

      mockSupabase.from = mockFrom

      // Act
      const result = await service.validateRestorationEligibility('1')

      // Assert
      expect(result.canRestore).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject restoration when original number is taken', async () => {
      // Arrange: Mock inactive patient with original number taken by someone else
      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '1',
                  patient_number: 'ARCHIVED_001',
                  name: '테스트',
                  is_active: false,
                  archived: true,
                  archived_at: new Date().toISOString(),
                  original_patient_number: 'TEST001',
                  created_at: new Date().toISOString()
                },
                error: null
              })
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: '2',
                      name: '다른환자'
                    },
                    error: null
                  })
                }))
              }))
            }))
          }))
        })

      mockSupabase.from = mockFrom

      // Act
      const result = await service.validateRestorationEligibility('1')

      // Assert
      expect(result.canRestore).toBe(false)
      expect(result.reason).toContain('다른 환자')
    })

    it('should reject restoration of already active patient', async () => {
      // Arrange: Mock active patient
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: '1',
                patient_number: 'TEST001',
                name: '테스트',
                is_active: true,
                archived: false,
                created_at: new Date().toISOString()
              },
              error: null
            })
          }))
        }))
      }))
      mockSupabase.from = mockFrom as any

      // Act
      const result = await service.validateRestorationEligibility('1')

      // Assert
      expect(result.canRestore).toBe(false)
      expect(result.reason).toContain('이미 활성화')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange: Mock database error
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'SOME_ERROR', message: 'Database error' }
                })
              }))
            }))
          }))
        }))
      }))
      mockSupabase.from = mockFrom as any

      // Act
      const result = await service.validatePatientNumber('TEST001')

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.conflictDetails?.message).toContain('오류')
    })
  })
})
