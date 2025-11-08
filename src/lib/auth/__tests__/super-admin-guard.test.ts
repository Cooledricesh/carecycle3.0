import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireSuperAdmin } from '../super-admin-guard';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Super Admin Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireSuperAdmin', () => {
    it('should throw Unauthorized error when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      await expect(requireSuperAdmin()).rejects.toThrow('Unauthorized');
    });

    it('should throw Forbidden error when user is not super_admin', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      await expect(requireSuperAdmin()).rejects.toThrow('Forbidden: Super Admin only');
    });

    it('should throw Forbidden error when profile is not found', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      await expect(requireSuperAdmin()).rejects.toThrow('Forbidden: Super Admin only');
    });

    it('should return user and supabase when user is super_admin', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockUser = { id: 'test-super-admin-id' };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'super_admin' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const result = await requireSuperAdmin();

      expect(result).toEqual({
        user: mockUser,
        supabase: mockSupabase,
      });
    });

    it('should throw Forbidden error for doctor role', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'doctor' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      await expect(requireSuperAdmin()).rejects.toThrow('Forbidden: Super Admin only');
    });

    it('should throw Forbidden error for nurse role', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'nurse' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      await expect(requireSuperAdmin()).rejects.toThrow('Forbidden: Super Admin only');
    });
  });
});
