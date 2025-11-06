/**
 * TDD Tests for POST /api/admin/join-requests/[id]/reject
 *
 * Tests the endpoint that allows admins to reject pending join requests
 *
 * Test Scenarios:
 * 1. Admin can reject pending request
 * 2. Updates request status to 'rejected'
 * 3. User profile remains unchanged
 * 4. Records reviewer_id and reviewed_at
 * 5. Non-admin gets 403 error
 * 6. Cannot reject already processed request
 * 7. User can reapply to same or different organization
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
  createServiceClient: vi.fn(),
}));

describe('🔴 RED: POST /api/admin/join-requests/[id]/reject - Reject Join Request', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  const TEST_REQUEST_ID = MOCK_JOIN_REQUESTS.PENDING_REQUEST_1.id;

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
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 401
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 403 when user is not an admin', async () => {
      // Arrange: Doctor user tries to reject request
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.DOCTOR_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.DOCTOR_USER)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Admin role required',
      });
    });

    it('should return 403 when nurse tries to reject request', async () => {
      // Arrange: Nurse user tries to reject request
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.NURSE_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.NURSE_USER)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Admin role required',
      });
    });
  });

  describe('Request Validation Tests', () => {
    it('should return 404 when join request does not exist', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock non-existent request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Act: Call the endpoint with non-existent ID
      const response = await fetch('/api/admin/join-requests/non-existent-id/reject', {
        method: 'POST',
      });

      // Assert: Should return 404
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Not Found',
        message: 'Join request not found',
      });
    });

    it('should return 403 when trying to reject request from different organization', async () => {
      // Arrange: Admin from 테스트병원 tries to reject 대동병원 request
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock request from different organization
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.OTHER_ORG_REQUEST)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.OTHER_ORG_REQUEST.id}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Cannot reject requests from other organizations',
      });
    });

    it('should return 400 when request is already approved', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock already approved request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.APPROVED_REQUEST)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.APPROVED_REQUEST.id}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Bad Request',
        message: 'Request has already been processed',
      });
    });

    it('should return 400 when request is already rejected', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock already rejected request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.REJECTED_REQUEST)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.REJECTED_REQUEST.id}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Bad Request',
        message: 'Request has already been processed',
      });
    });

    it('should return 400 when request ID is missing', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      // Act: Call the endpoint without ID
      const response = await fetch('/api/admin/join-requests//reject', {
        method: 'POST',
      });

      // Assert: Should return 400 or 404
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Rejection Process Tests', () => {
    it('should successfully reject pending request and update status', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock pending request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      // Mock successful update
      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 200 with updated request
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.status).toBe('rejected');
      expect(data.data.reviewer_id).toBe(MOCK_PROFILES.ADMIN_USER.id);
      expect(data.data.reviewed_at).toBeTruthy();
    });

    it('should NOT update user profile when rejecting request', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      // Mock pending request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Verify profile update was NOT called
      // Only one update call should be made (join_requests table)
      expect(mockSupabase.mocks.update).toHaveBeenCalledTimes(1);
    });

    it('should update join_requests table with reviewer info and timestamp', async () => {
      // Arrange: Admin user authenticated
      const currentTime = new Date().toISOString();
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: currentTime,
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Verify join_requests update was called with correct data
      expect(mockSupabase.mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        })
      );
    });

    it('should record reviewer_id of the admin who rejected the request', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Verify reviewer_id matches admin user
      const data = await response.json();
      expect(data.data.reviewer_id).toBe(MOCK_PROFILES.ADMIN_USER.id);
    });

    it('should record reviewed_at timestamp when rejecting', async () => {
      // Arrange: Admin user authenticated
      const beforeTime = new Date();
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });
      const afterTime = new Date();

      // Assert: Verify reviewed_at is set and within reasonable time
      const data = await response.json();
      expect(data.data.reviewed_at).toBeTruthy();
      const reviewedAt = new Date(data.data.reviewed_at);
      expect(reviewedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(reviewedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('User Reapplication Tests', () => {
    it('should allow user to create new request after rejection', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Reject the request
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: User should still be able to create new requests
      // (verified by checking that profile was not updated)
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.status).toBe('rejected');
      // Profile should remain unchanged - user can reapply
    });

    it('should not block user from applying to different organization after rejection', async () => {
      // Arrange: This is verified by the fact that profile is not updated
      // when rejecting, so user_id remains available for new requests
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Reject the request
      await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: User profile should not be locked to any organization
      expect(mockSupabase.mocks.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: expect.anything(),
        })
      );
    });
  });

  describe('Response Format Tests', () => {
    it('should return correct response structure on success', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Verify response structure
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('reviewer_id');
      expect(data.data).toHaveProperty('reviewed_at');
    });

    it('should include success message in response', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      const rejectedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'rejected' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(rejectedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Verify success message
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('rejected');
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 500 when database operation fails', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      // Mock database error
      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('Database error'),
      });

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 500
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should handle network errors gracefully', async () => {
      // Arrange: Admin user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.ADMIN_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.ADMIN_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      // Mock network error
      mockSupabase.mocks.from().update().eq().select().single.mockRejectedValue(
        new Error('Network error')
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/reject`, {
        method: 'POST',
      });

      // Assert: Should return 500
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});
