/**
 * TDD Tests for POST /api/join-requests
 *
 * Tests the endpoint that allows authenticated users to create join requests
 *
 * Test Scenarios:
 * 1. Authenticated user can create join request
 * 2. Validates organization exists
 * 3. Prevents duplicate pending requests
 * 4. Validates role is one of: admin, doctor, nurse
 * 5. Requires valid email format
 * 6. Unauthenticated users get 401 error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MOCK_PROFILES,
  MOCK_JOIN_REQUESTS,
  TEST_ORGANIZATIONS,
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

describe('🔴 RED: POST /api/join-requests - Create Join Request', () => {
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
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 401
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should allow authenticated users with no organization to create request', async () => {
      // Arrange: Pending user with no organization
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock no existing pending requests
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock organization exists
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      // Mock successful insert
      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });

    it('should reject users who already have an organization', async () => {
      // Arrange: Doctor user already has organization
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.DOCTOR_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.DOCTOR_USER)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Bad Request',
        message: 'User already belongs to an organization',
      });
    });
  });

  describe('Request Validation Tests', () => {
    it('should require organization_id in request body', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Act: Call the endpoint without organization_id
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('organization_id');
    });

    it('should require requested_role in request body', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Act: Call the endpoint without requested_role
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('requested_role');
    });

    it('should validate requested_role is one of: admin, doctor, nurse', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Act: Call the endpoint with invalid role
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'superuser',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('role');
    });

    it('should accept "admin" as valid requested_role', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock no existing pending requests
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock organization exists
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'admin' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'admin',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });

    it('should accept "doctor" as valid requested_role', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'doctor' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'doctor',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });

    it('should accept "nurse" as valid requested_role', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });
  });

  describe('Organization Validation Tests', () => {
    it('should verify organization exists before creating request', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock no existing pending requests
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock organization doesn't exist
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'non-existent-org-id',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 404
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Not Found',
        message: 'Organization not found',
      });
    });

    it('should allow requests to test organizations (테스트병원, 대동병원)', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock test organization exists
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.organization_name).toBe(TEST_ORGANIZATIONS.TEST_HOSPITAL);
    });
  });

  describe('Duplicate Request Prevention Tests', () => {
    it('should prevent duplicate pending requests for same organization', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock existing pending request
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_JOIN_REQUESTS.PENDING_REQUEST_1)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        error: 'Bad Request',
        message: 'You already have a pending request for this organization',
      });
    });

    it('should allow new request after previous one was rejected', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock no pending requests (previous was rejected)
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock organization exists
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-002',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });

    it('should allow requests to different organizations', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      // Mock no pending request for this organization
      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      // Mock organization exists
      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-daedong-hospital-001', name: TEST_ORGANIZATIONS.DAEDONG_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-003',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-daedong-hospital-001',
        organization_name: TEST_ORGANIZATIONS.DAEDONG_HOSPITAL,
        requested_role: 'doctor' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-daedong-hospital-001',
          requested_role: 'doctor',
        }),
      });

      // Assert: Should return 201
      expect(response.status).toBe(201);
    });
  });

  describe('Email Validation Tests', () => {
    it('should use authenticated user email for the request', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should use user's email from profile
      const data = await response.json();
      expect(data.data.email).toBe(MOCK_PROFILES.PENDING_USER.email);
    });

    it('should reject request when user email is missing', async () => {
      // Arrange: User without email
      const userWithoutEmail = {
        ...MOCK_PROFILES.PENDING_USER,
        email: null,
      };

      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(userWithoutEmail) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(userWithoutEmail)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('email');
    });
  });

  describe('Success Response Tests', () => {
    it('should return 201 with created join request on success', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 201 with correct structure
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('id');
      expect(data.data.status).toBe('pending');
      expect(data.data.requested_role).toBe('nurse');
    });

    it('should include all required fields in created request', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Verify all required fields
      const data = await response.json();
      const request = data.data;

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

      // Verify initial values
      expect(request.status).toBe('pending');
      expect(request.reviewed_at).toBeNull();
      expect(request.reviewer_id).toBeNull();
    });

    it('should include success message in response', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      const newRequest = {
        id: 'new-join-req-001',
        user_id: MOCK_PROFILES.PENDING_USER.id,
        email: MOCK_PROFILES.PENDING_USER.email,
        organization_id: 'org-test-hospital-001',
        organization_name: TEST_ORGANIZATIONS.TEST_HOSPITAL,
        requested_role: 'nurse' as const,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_id: null,
      };

      mockSupabase.mocks.from().insert().select().single.mockResolvedValue(
        createMockSupabaseResponse(newRequest)
      );

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Verify success message
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('created');
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 500 when database insert fails', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      mockSupabase.mocks.from().select().single.mockResolvedValue(
        createMockSupabaseResponse(MOCK_PROFILES.PENDING_USER)
      );

      mockSupabase.mocks.from().select().eq().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('No rows found', 'PGRST116'),
      });

      mockSupabase.mocks.from().select().eq().single.mockResolvedValueOnce(
        createMockSupabaseResponse({ id: 'org-test-hospital-001', name: TEST_ORGANIZATIONS.TEST_HOSPITAL })
      );

      // Mock database error
      mockSupabase.mocks.from().insert().select().single.mockResolvedValue({
        data: null,
        error: createMockSupabaseError('Database error'),
      });

      // Act: Call the endpoint
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'org-test-hospital-001',
          requested_role: 'nurse',
        }),
      });

      // Assert: Should return 500
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 400 when request body is malformed JSON', async () => {
      // Arrange: Pending user authenticated
      mockSupabase.mocks.auth.getUser.mockResolvedValue({
        data: { user: createMockAuthUser(MOCK_PROFILES.PENDING_USER) },
        error: null,
      });

      // Act: Call the endpoint with malformed JSON
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{',
      });

      // Assert: Should return 400
      expect(response.status).toBe(400);
    });
  });
});
