import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH, PUT } from '../[id]/route'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'admin', organization_id: 'test-org-id' },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'test-dept-id',
          name: 'Updated Department',
          description: 'Updated description',
          display_order: 1,
          is_active: true,
          organization_id: 'test-org-id',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      }),
    })),
  })),
}))

describe('Department API - PATCH Method Support', () => {
  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/admin/departments/test-id', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  const mockParams = Promise.resolve({ id: 'test-dept-id' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle PATCH request successfully', async () => {
    const request = createMockRequest({
      name: 'Updated Department',
      description: 'Updated description',
      display_order: 1,
    })

    const response = await PATCH(request, { params: mockParams })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.department).toBeDefined()
    expect(data.department.name).toBe('Updated Department')
  })

  it('should handle partial updates with PATCH', async () => {
    const request = createMockRequest({
      name: 'Only Name Updated',
    })

    const response = await PATCH(request, { params: mockParams })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.department).toBeDefined()
  })

  it('should validate input with Zod schema', async () => {
    const request = createMockRequest({
      name: '', // Invalid: empty string
    })

    const response = await PATCH(request, { params: mockParams })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid input')
  })

  it('should return 401 for unauthorized users', async () => {
    // Mock unauthorized user
    vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Unauthorized' },
        }),
      },
    })) as any

    const request = createMockRequest({
      name: 'Test',
    })

    const response = await PATCH(request, { params: mockParams })
    expect(response.status).toBe(401)
  })
})

describe('Department API - Backward Compatibility', () => {
  const createMockRequest = (method: 'PUT' | 'PATCH', body: any) => {
    return new NextRequest('http://localhost:3000/api/admin/departments/test-id', {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  const mockParams = Promise.resolve({ id: 'test-dept-id' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should support both PUT and PATCH methods', async () => {
    const updateData = {
      name: 'Test Department',
      description: 'Test description',
      display_order: 1,
    }

    // Test PUT
    const putRequest = createMockRequest('PUT', updateData)
    const putResponse = await PUT(putRequest, { params: mockParams })
    expect(putResponse.status).toBe(200)

    // Test PATCH
    const patchRequest = createMockRequest('PATCH', updateData)
    const patchResponse = await PATCH(patchRequest, { params: mockParams })
    expect(patchResponse.status).toBe(200)
  })

  it('should produce identical results for PUT and PATCH', async () => {
    const updateData = {
      name: 'Consistent Department',
      description: 'Should be same',
      display_order: 5,
    }

    const putRequest = createMockRequest('PUT', updateData)
    const putResponse = await PUT(putRequest, { params: mockParams })
    const putData = await putResponse.json()

    const patchRequest = createMockRequest('PATCH', updateData)
    const patchResponse = await PATCH(patchRequest, { params: mockParams })
    const patchData = await patchResponse.json()

    expect(putData.department).toBeDefined()
    expect(patchData.department).toBeDefined()
    expect(putData.department.name).toBe(patchData.department.name)
    expect(putData.department.description).toBe(patchData.department.description)
    expect(putData.department.display_order).toBe(patchData.department.display_order)
  })
})
