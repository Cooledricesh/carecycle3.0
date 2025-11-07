// @ts-nocheck - Skipped integration tests

/**
 * TDD Tests for POST /api/admin/join-requests/[id]/approve
 *
 * Tests the endpoint that allows admins to approve pending join requests
 *
 * Test Scenarios:
 * 1. Admin can approve pending request
 * 2. Updates user's profile with organization_id
 * 3. Updates request status to 'approved'
 * 4. Records reviewer_id and reviewed_at
 * 5. Non-admin gets 403 error
 * 6. Cannot approve already processed request
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

describe.skip('🔴 RED: POST /api/admin/join-requests/[id]/approve - Approve Join Request', () => {
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
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
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
      // Arrange: Doctor user tries to approve request
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.DOCTOR_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.DOCTOR_USER)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
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

    it('should return 403 when nurse tries to approve request', async () => {
      // Arrange: Nurse user tries to approve request
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.NURSE_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.NURSE_USER)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
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
      const response = await fetch('/api/admin/join-requests/non-existent-id/approve', {
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

    it('should return 403 when trying to approve request from different organization', async () => {
      // Arrange: Admin from 테스트병원 tries to approve 대동병원 request
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
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.OTHER_ORG_REQUEST.id}/approve`, {
        method: 'POST',
      });

      // Assert: Should return 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Cannot approve requests from other organizations',
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
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.APPROVED_REQUEST.id}/approve`, {
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
      const response = await fetch(`/api/admin/join-requests/${MOCK_JOIN_REQUESTS.REJECTED_REQUEST.id}/approve`, {
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
      const response = await fetch('/api/admin/join-requests//approve', {
        method: 'POST',
      });

      // Assert: Should return 400 or 404
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Approval Process Tests', () => {
    it('should successfully approve pending request and update all required fields', async () => {
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
      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Should return 200 with updated request
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.status).toBe('approved');
      expect(data.data.reviewer_id).toBe(MOCK_PROFILES.ADMIN_USER.id);
      expect(data.data.reviewed_at).toBeTruthy();
    });

    it('should update user profile with organization_id and role', async () => {
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

      // Mock successful updates
      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Verify profile update was called with correct data
      expect(mockSupabase.mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: MOCK_JOIN_REQUESTS.PENDING_REQUEST_1.organization_id,
          role: MOCK_JOIN_REQUESTS.PENDING_REQUEST_1.requested_role,
        })
      );
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

      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: currentTime,
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Verify join_requests update was called
      expect(mockSupabase.mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        })
      );
    });

    it('should perform all updates in a transaction (both tables)', async () => {
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

      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Verify both updates occurred
      expect(response.status).toBe(200);
      expect(mockSupabase.mocks.update).toHaveBeenCalledTimes(2); // profiles + join_requests
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

      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
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

      const approvedRequest = {
        ...MOCK_JOIN_REQUESTS.PENDING_REQUEST_1,
        status: 'approved' as const,
        reviewer_id: MOCK_PROFILES.ADMIN_USER.id,
        reviewed_at: new Date().toISOString(),
      };

      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValue(
        createMockSupabaseResponse(approvedRequest)
      );

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Verify success message
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('approved');
    });
  });

  describe('Error Handling Tests', () => {
    it('should rollback on profile update failure', async () => {
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

      // Mock profile update failure
      mockSupabase.mocks.from().update().eq().select().single.mockResolvedValueOnce({
        data: null,
        error: createMockSupabaseError('Profile update failed'),
      });

      // Act: Call the endpoint
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Should return error and not update join_requests
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

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
      const response = await fetch(`/api/admin/join-requests/${TEST_REQUEST_ID}/approve`, {
        method: 'POST',
      });

      // Assert: Should return 500
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});
