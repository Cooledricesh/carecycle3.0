import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/super-admin-guard', () => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

describe('Organizations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/super-admin/organizations', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      vi.mocked(requireSuperAdmin).mockRejectedValue(new Error('Unauthorized'));

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not super_admin', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      vi.mocked(requireSuperAdmin).mockRejectedValue(new Error('Forbidden: Super Admin only'));

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden: Super Admin only');
    });

    it('should return all organizations with user counts for super_admin', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      const { createServiceClient } = await import('@/lib/supabase/server');

      const mockOrganizations = [
        { id: 'org-1', name: 'Org 1', is_active: true, created_at: '2025-01-01' },
        { id: 'org-2', name: 'Org 2', is_active: true, created_at: '2025-01-02' },
      ];

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockOrganizations,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: 5,
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(requireSuperAdmin).mockResolvedValue({
        user: { id: 'super-admin-id' } as any,
        supabase: mockSupabase as any,
      });
      vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.organizations.length).toBe(2);
      expect(data.organizations[0].name).toBe('Org 1');
    });

    it('should filter by is_active when query parameter is provided', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      const { createServiceClient } = await import('@/lib/supabase/server');

      const mockOrganizations = [
        { id: 'org-1', name: 'Active Org', is_active: true, created_at: '2025-01-01' },
      ];

      const eqMock = vi.fn().mockResolvedValue({
        data: mockOrganizations,
        error: null,
      });

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  eq: eqMock,
                }),
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: 5,
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(requireSuperAdmin).mockResolvedValue({
        user: { id: 'super-admin-id' } as any,
        supabase: mockSupabase as any,
      });
      vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations?is_active=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('POST /api/super-admin/organizations', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      vi.mocked(requireSuperAdmin).mockRejectedValue(new Error('Unauthorized'));

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Org' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not super_admin', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      vi.mocked(requireSuperAdmin).mockRejectedValue(new Error('Forbidden: Super Admin only'));

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Org' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should return 400 when validation fails (empty name)', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');

      vi.mocked(requireSuperAdmin).mockResolvedValue({
        user: { id: 'super-admin-id' } as any,
        supabase: {} as any,
      });

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('should create organization and audit log for valid request', async () => {
      const { requireSuperAdmin } = await import('@/lib/auth/super-admin-guard');
      const { createServiceClient } = await import('@/lib/supabase/server');

      const mockOrganization = {
        id: 'new-org-id',
        name: 'New Organization',
        is_active: true,
        created_at: '2025-01-01',
      };

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'organizations') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockOrganization,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'audit_logs') {
            return {
              insert: vi.fn().mockResolvedValue({
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(requireSuperAdmin).mockResolvedValue({
        user: { id: 'super-admin-id', email: 'admin@example.com' } as any,
        supabase: mockSupabase as any,
      });
      vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/api/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Organization' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.organization).toEqual(mockOrganization);

      // Verify audit log was created
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    });
  });
});
