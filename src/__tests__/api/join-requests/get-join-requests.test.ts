/**
 * TDD Tests for GET /api/admin/join-requests
 *
 * Tests the endpoint that lists pending join requests for organization admins
 *
 * Test Scenarios:
 * 1. Admin can view pending requests for their organization
 * 2. Admin cannot view requests from other organizations
 * 3. Non-admin users get 403 error
 * 4. Returns requests sorted by created_at (newest first)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MOCK_PROFILES,
  MOCK_JOIN_REQUESTS,
  createMockSupabaseClient,
  createMockAuthUser,
  createMockSupabaseResponse,
  createMockSupabaseError,
} from './test-fixtures';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('🔴 RED: GET /api/admin/join-requests - List Join Requests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  describe('Authorization Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange: No authenticated user
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: createMockSupabaseError('Not authenticated'),
      });

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 401
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 403 when user is not an admin', async () => {
      // Arrange: Doctor user tries to access admin endpoint
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.DOCTOR_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.DOCTOR_USER)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Admin role required',
      });
    });

    it('should return 403 when nurse tries to access admin endpoint', async () => {
      // Arrange: Nurse user tries to access admin endpoint
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.NURSE_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.NURSE_USER)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Admin role required',
      });
    });
  });

  describe('Organization Isolation Tests', () => {
    it('should return only pending requests from admin\'s organization', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock join requests query - should filter by organization_id and status
      const expectedRequests = [
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_2,
      ];

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse(expectedRequests)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 200 with filtered requests
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.data[0].organization_id).toBe(MOCK_PROFILES.ADMIN_USER.organization_id);
      expect(data.data[1].organization_id).toBe(MOCK_PROFILES.ADMIN_USER.organization_id);
    });

    it('should NOT return requests from other organizations', async () => {
      // Arrange: Admin from 테스트병원
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock join requests - should NOT include OTHER_ORG_REQUEST
      const expectedRequests = [
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_2,
      ];

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse(expectedRequests)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should not include 대동병원 requests
      const data = await response.json();
      const hasDaedongRequest = data.data.some(
        (req: typeof MOCK_JOIN_REQUESTS.OTHER_ORG_REQUEST) =>
          req.organization_name === '대동병원'
      );
      expect(hasDaedongRequest).toBe(false);
    });

    it('should verify organization_id filter is applied in database query', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([])
      );

      // Act: Call the endpoint
      await fetch('/api/admin/join-requests');

      // Assert: Verify .eq('organization_id') was called
      expect(mockSupabase.mocks.eq).toHaveBeenCalledWith(
        'organization_id',
        MOCK_PROFILES.ADMIN_USER.organization_id
      );
    });
  });

  describe('Status Filtering Tests', () => {
    it('should return only pending requests, not approved or rejected', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock only pending requests
      const expectedRequests = [
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_2,
      ];

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse(expectedRequests)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: All returned requests should have status 'pending'
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      data.data.forEach((request: typeof MOCK_JOIN_REQUESTS.PENDING_REQUEST_1) => {
        expect(request.status).toBe('pending');
      });
    });

    it('should verify status filter is applied in database query', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([])
      );

      // Act: Call the endpoint
      await fetch('/api/admin/join-requests');

      // Assert: Verify .eq('status', 'pending') was called
      expect(mockSupabase.mocks.eq).toHaveBeenCalledWith('status', 'pending');
    });
  });

  describe('Sorting Tests', () => {
    it('should return requests sorted by created_at in descending order (newest first)', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock requests - newest first
      const expectedRequests = [
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_1, // 10:00
        MOCK_JOIN_REQUESTS.PENDING_REQUEST_2, // 09:00
      ];

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse(expectedRequests)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Verify order
      const data = await response.json();
      expect(data.data[0].created_at).toBe('2025-01-07T10:00:00Z');
      expect(data.data[1].created_at).toBe('2025-01-07T09:00:00Z');

      // Verify order is DESC
      const firstDate = new Date(data.data[0].created_at);
      const secondDate = new Date(data.data[1].created_at);
      expect(firstDate.getTime()).toBeGreaterThan(secondDate.getTime());
    });

    it('should verify order by created_at desc is applied in database query', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([])
      );

      // Act: Call the endpoint
      await fetch('/api/admin/join-requests');

      // Assert: Verify .order() was called correctly
      expect(mockSupabase.mocks.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });
  });

  describe('Response Format Tests', () => {
    it('should return correct response structure with data array', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([MOCK_JOIN_REQUESTS.PENDING_REQUEST_1])
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Verify response structure
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should include all required fields in each join request', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([MOCK_JOIN_REQUESTS.PENDING_REQUEST_1])
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Verify all required fields present
      const data = await response.json();
      const request = data.data[0];

      expect(request).toHaveProperty('id');
      expect(request).toHaveProperty('user_id');
      expect(request).toHaveProperty('email');
      expect(request).toHaveProperty('organization_id');
      expect(request).toHaveProperty('organization_name');
      expect(request).toHaveProperty('requested_role');
      expect(request).toHaveProperty('status');
      expect(request).toHaveProperty('created_at');
      expect(request).toHaveProperty('reviewed_at');
      expect(request).toHaveProperty('reviewer_id');
    });

    it('should return empty array when no pending requests exist', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().order.mockResolvedValue(
        createMockSupabaseResponse([])
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return empty array
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual([]);
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 500 when database query fails', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock database error
      mockSupabase.mocks.from().select().eq().order.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('Database connection failed'),
      });

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 500
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 403 when admin has no organization_id', async () => {
      // Arrange: Admin user without organization_id
      const adminWithoutOrg = {
        ...MOCK_PROFILES.ADMIN_USER,
        organization_id: null,
      };

      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(adminWithoutOrg) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(adminWithoutOrg)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/admin/join-requests');

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Organization ID required',
      });
    });
  });
});
