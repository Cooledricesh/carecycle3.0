import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../page';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
    },
  })),
}));

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('페이지가 렌더링되어야 함', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        policy: {
          id: 'test-id',
          organization_id: 'org-id',
          auto_hold_overdue_days: 30,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      }),
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('조직 정책 설정')).toBeInTheDocument();
    });
  });

  it('자동 보류 일수 필드가 표시되어야 함', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        policy: {
          auto_hold_overdue_days: 30,
        },
      }),
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/자동 보류 기준 일수/i)).toBeInTheDocument();
    });
  });

  it('정책 데이터를 로드하여 폼에 표시해야 함', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        policy: {
          auto_hold_overdue_days: 45,
        },
      }),
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      const input = screen.getByLabelText(/자동 보류 기준 일수/i) as HTMLInputElement;
      expect(input.value).toBe('45');
    });
  });

  it('저장 버튼을 클릭하면 API를 호출해야 함', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ policy: { auto_hold_overdue_days: 30 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ policy: { auto_hold_overdue_days: 60 } }),
      });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/자동 보류 기준 일수/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/자동 보류 기준 일수/i);
    fireEvent.change(input, { target: { value: '60' } });

    const saveButton = screen.getByRole('button', { name: /저장/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/organization-policies',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ auto_hold_overdue_days: 60 }),
        })
      );
    });
  });

  it('음수 값을 입력하면 validation 에러가 발생해야 함', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ policy: { auto_hold_overdue_days: 30 } }),
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/자동 보류 기준 일수/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/자동 보류 기준 일수/i);
    fireEvent.change(input, { target: { value: '-10' } });

    const saveButton = screen.getByRole('button', { name: /저장/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // 에러 메시지 또는 toast가 표시되어야 함
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/admin/organization-policies',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('로딩 중에 스켈레톤을 표시해야 함', () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // 무한 대기
    );

    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
