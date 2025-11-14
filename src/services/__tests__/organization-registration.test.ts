/**
 * Organization Registration Service Tests
 *
 * Tests for submitOrganizationRequest flow
 * Follows TDD principles: RED -> GREEN -> REFACTOR
 *
 * Critical test: Duplicate check MUST happen BEFORE user creation
 * to prevent orphaned auth.users records
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the server client BEFORE importing the module
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Import after mocking
import { submitOrganizationRequest } from '../organization-registration'
import { createServiceClient } from '@/lib/supabase/server'

describe('submitOrganizationRequest', () => {
  let mockSupabase: any

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        signUp: vi.fn(),
        admin: {
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn(),
    }

    // Mock createServiceClient to return our mock
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase)
  })

  describe('Duplicate Organization Check Flow', () => {
    it('should NOT create auth user when organization name is duplicate', async () => {
      // Setup: Mock organization check to return existing org
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-org-id' },
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue(mockOrgQuery)

      // Execute
      const result = await submitOrganizationRequest({
        organizationName: '테스트병원',
        organizationDescription: '테스트 설명',
        requesterName: '홍길동',
        requesterEmail: 'test@example.com',
        password: 'Test123!@#',
        passwordConfirm: 'Test123!@#',
      })

      // Assert: signUp should NOT be called
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled()

      // Assert: Result should indicate duplicate
      expect(result.success).toBe(false)
      expect(result.error).toContain('이미 존재하는')
    })

    it('should create auth user ONLY when organization name is unique', async () => {
      // Setup: Mock organization check to return no existing org
      const mockOrgCheckQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      // Mock successful user creation
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      // Mock successful organization_requests insert
      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-request-id' },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return mockOrgCheckQuery
        }
        if (table === 'organization_requests') {
          return mockInsertQuery
        }
      })

      // Execute
      const result = await submitOrganizationRequest({
        organizationName: '신규병원',
        organizationDescription: '신규 설명',
        requesterName: '김철수',
        requesterEmail: 'newuser@example.com',
        password: 'Test123!@#',
        passwordConfirm: 'Test123!@#',
      })

      // Assert: signUp should be called AFTER duplicate check
      expect(mockSupabase.auth.signUp).toHaveBeenCalledTimes(1)

      // Assert: Result should be successful
      expect(result.success).toBe(true)
      expect(result.requestId).toBe('new-request-id')
    })
  })

  describe('Error Handling Without Rollback', () => {
    it('should NOT call deleteUser when duplicate is found', async () => {
      // Setup: Mock duplicate organization
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-org-id' },
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue(mockOrgQuery)

      // Execute
      await submitOrganizationRequest({
        organizationName: '테스트병원',
        organizationDescription: '테스트 설명',
        requesterName: '홍길동',
        requesterEmail: 'test@example.com',
        password: 'Test123!@#',
        passwordConfirm: 'Test123!@#',
      })

      // Assert: deleteUser should NOT be called (no user was created)
      expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled()
    })

    it('should handle organization_requests insert failure gracefully', async () => {
      // Setup: Mock unique organization name (check passes)
      const mockOrgCheckQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      // Mock successful user creation
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      // Mock failed organization_requests insert
      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' },
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return mockOrgCheckQuery
        }
        if (table === 'organization_requests') {
          return mockInsertQuery
        }
      })

      // Execute
      const result = await submitOrganizationRequest({
        organizationName: '신규병원',
        organizationDescription: '신규 설명',
        requesterName: '김철수',
        requesterEmail: 'newuser@example.com',
        password: 'Test123!@#',
        passwordConfirm: 'Test123!@#',
      })

      // Assert: Result should fail
      expect(result.success).toBe(false)

      // Note: In this case, we DO expect cleanup
      // This test documents current behavior - may need separate rollback strategy
    })
  })

  describe('Validation', () => {
    it('should validate input with Zod schema', async () => {
      // Execute with invalid input (missing required fields)
      const result = await submitOrganizationRequest({
        organizationName: '',
        organizationDescription: '',
        requesterName: '',
        requesterEmail: 'invalid-email',
        password: 'short',
      } as any)

      // Assert: Should fail validation
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Execution Order Verification', () => {
    it('should execute steps in correct order: CHECK -> CREATE -> INSERT', async () => {
      const executionOrder: string[] = []

      // Setup mocks that track execution order
      const mockOrgCheckQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => {
          executionOrder.push('CHECK_DUPLICATE')
          return { data: null, error: null }
        }),
      }

      mockSupabase.auth.signUp.mockImplementation(async () => {
        executionOrder.push('CREATE_USER')
        return {
          data: { user: { id: 'user-id', email: 'test@example.com' } },
          error: null,
        }
      })

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(async () => {
          executionOrder.push('INSERT_REQUEST')
          return { data: { id: 'request-id' }, error: null }
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return mockOrgCheckQuery
        }
        if (table === 'organization_requests') {
          return mockInsertQuery
        }
      })

      // Execute
      await submitOrganizationRequest({
        organizationName: '신규병원',
        organizationDescription: '신규 설명',
        requesterName: '김철수',
        requesterEmail: 'newuser@example.com',
        password: 'Test123!@#',
        passwordConfirm: 'Test123!@#',
      })

      // Assert: Execution order must be correct
      expect(executionOrder).toEqual([
        'CHECK_DUPLICATE',
        'CREATE_USER',
        'INSERT_REQUEST',
      ])
    })
  })
})
