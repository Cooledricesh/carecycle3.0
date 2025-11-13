import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUpForm } from '../signup-form';
import { createClient } from '@/lib/supabase/client';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('SignUpForm - 중복 제출 방지', () => {
  let mockSignUp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful signUp
    mockSignUp = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signUp: mockSignUp,
      },
    });
  });

  it('버튼 더블클릭 시 signUp이 한 번만 호출되어야 함', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    // Simulate double click
    await user.click(submitButton);
    await user.click(submitButton);

    // Wait for async operations
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(1);
    });
  });

  it('동시 폼 제출 시 signUp이 한 번만 호출되어야 함 (실제 더블클릭 시뮬레이션)', async () => {
    // Slow down signUp to simulate network delay
    mockSignUp.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
          error: null,
        }), 100)
      )
    );

    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    // Simulate rapid clicks without waiting
    const clickPromise1 = user.click(submitButton);
    const clickPromise2 = user.click(submitButton);

    await Promise.all([clickPromise1, clickPromise2]);

    // Wait for async operations
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it('빠른 연속 클릭(triple click) 시에도 한 번만 호출되어야 함', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    // Simulate triple click
    await user.tripleClick(submitButton);

    // Wait for async operations
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(1);
    });
  });

  it('에러 발생 후에도 재시도가 가능해야 함', async () => {
    // First call fails
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Network error' },
    });

    // Second call succeeds
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    // First attempt - should fail
    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    expect(mockSignUp).toHaveBeenCalledTimes(1);

    // Second attempt - should succeed
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(2);
    });
  });

  it('Rate limit 에러 발생 시 적절한 메시지를 표시해야 함', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Email rate limit exceeded' },
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Email rate limit exceeded/i)).toBeInTheDocument();
    });
  });

  it('정상적인 회원가입 플로우가 유지되어야 함', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill form
    await user.type(screen.getByLabelText(/이름/i), '테스트유저');
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^비밀번호$/i), 'Test123!@#');
    await user.type(screen.getByLabelText(/비밀번호 확인/i), 'Test123!@#');

    const submitButton = screen.getByRole('button', { name: /다음 단계/i });

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Test123!@#',
        options: {
          data: {
            name: '테스트유저',
            role: 'nurse',
          },
        },
      });
    });

    // Should navigate to organization step
    await waitFor(() => {
      expect(screen.getByText(/조직을 선택하세요/i)).toBeInTheDocument();
    });
  });
});
