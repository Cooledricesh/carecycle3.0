import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RequireSuperAdmin } from '../RequireSuperAdmin';
import { useAuth } from '@/providers/auth-provider-simple';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Mock dependencies
vi.mock('@/providers/auth-provider-simple');
vi.mock('@/lib/supabase/client');

describe('RequireSuperAdmin Component', () => {
  const mockUseAuth = vi.mocked(useAuth);
  const mockCreateClient = vi.mocked(createClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner while auth is loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      expect(screen.getByText(/로딩 중/i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show loading spinner while fetching user role', async () => {
      // Arrange
      const mockUser = { id: 'user-123' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      // Simulate delayed profile fetch
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue(
              new Promise((resolve) => setTimeout(() => resolve({ data: null }), 100))
            ),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert - should show loading during role check
      expect(screen.getByText(/로딩 중/i)).toBeInTheDocument();
    });
  });

  describe('Access Denied State', () => {
    it('should show access denied message when user is not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Super Admin 권한이 필요합니다/i).length).toBeGreaterThan(0);
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show access denied message when user is admin (not super_admin)', async () => {
      // Arrange
      const mockUser = { id: 'user-123' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Super Admin 권한이 필요합니다/i).length).toBeGreaterThan(0);
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show access denied message when user is doctor', async () => {
      // Arrange
      const mockUser = { id: 'user-456' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'doctor' },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show access denied message when user is nurse', async () => {
      // Arrange
      const mockUser = { id: 'user-789' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'nurse' },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show access denied message when role fetch fails', async () => {
      // Arrange
      const mockUser = { id: 'user-error' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Success State - Super Admin Access', () => {
    it('should render children when user is super_admin', async () => {
      // Arrange
      const mockUser = { id: 'super-admin-123' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'super_admin' },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      expect(screen.queryByText(/접근 권한 없음/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/로딩 중/i)).not.toBeInTheDocument();
    });

    it('should render multiple children when user is super_admin', async () => {
      // Arrange
      const mockUser = { id: 'super-admin-456' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'super_admin' },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Header Content</div>
          <div>Body Content</div>
          <div>Footer Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Header Content')).toBeInTheDocument();
        expect(screen.getByText('Body Content')).toBeInTheDocument();
        expect(screen.getByText('Footer Content')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null role gracefully', async () => {
      // Arrange
      const mockUser = { id: 'user-null-role' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: null },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should handle undefined role gracefully', async () => {
      // Arrange
      const mockUser = { id: 'user-undefined-role' } as User;
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: undefined },
              error: null,
            }),
          }),
        }),
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      render(
        <RequireSuperAdmin>
          <div>Protected Content</div>
        </RequireSuperAdmin>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/접근 권한 없음/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});
