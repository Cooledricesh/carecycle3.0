/**
 * Organization Signup Component Tests
 *
 * Test suite for organization creation/selection UI during user signup.
 * Follows TDD principles: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn()
  })
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        ilike: vi.fn(async () => ({
          data: [],
          error: null
        }))
      }))
    })),
    rpc: vi.fn(async () => ({
      data: { organization_id: 'test-org-id' },
      error: null
    }))
  })
}));

// Component to be implemented
interface OrganizationSignupFormProps {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  onComplete: (organizationId: string) => void;
}

// Mock component (will fail until real implementation exists)
const MockOrganizationSignupForm: React.FC<OrganizationSignupFormProps> = () => {
  return <div data-testid="org-signup-form">Not Implemented</div>;
};

describe('OrganizationSignupForm Component', () => {
  const mockProps: OrganizationSignupFormProps = {
    userId: 'user-123',
    userEmail: 'test@example.com',
    userName: '테스트유저',
    userRole: 'admin',
    onComplete: vi.fn()
  };

  describe('Component Rendering', () => {
    it('should render organization signup form', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);
      expect(screen.getByTestId('org-signup-form')).toBeInTheDocument();
    });

    it('should display option to create new organization', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);
      expect(screen.getByText(/새 조직 만들기/i)).toBeInTheDocument();
    });

    it('should display option to join existing organization', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);
      expect(screen.getByText(/기존 조직 가입/i)).toBeInTheDocument();
    });

    it('should show organization search input when join option selected', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      expect(screen.getByPlaceholderText(/조직 이름으로 검색/i)).toBeInTheDocument();
    });

    it('should show organization name input when create option selected', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      expect(screen.getByPlaceholderText(/조직 이름 입력/i)).toBeInTheDocument();
    });
  });

  describe('Organization Search Functionality', () => {
    it('should search organizations as user types', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: '테스트' } });

      await waitFor(() => {
        expect(screen.getByText(/검색 결과/i)).toBeInTheDocument();
      });
    });

    it('should display search results', async () => {
      // Mock search results
      const mockResults = [
        { id: 'org-1', name: '테스트병원' },
        { id: 'org-2', name: '테스트새병원' }
      ];

      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: '테스트' } });

      await waitFor(() => {
        mockResults.forEach(org => {
          expect(screen.getByText(org.name)).toBeInTheDocument();
        });
      });
    });

    it('should show "no results" message when search returns empty', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentOrg' } });

      await waitFor(() => {
        expect(screen.getByText(/검색 결과가 없습니다/i)).toBeInTheDocument();
      });
    });

    it('should handle search errors gracefully', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: 'error' } });

      await waitFor(() => {
        expect(screen.getByText(/검색 중 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });

    it('should debounce search input to avoid excessive API calls', async () => {
      const searchSpy = vi.fn();
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);

      // Type quickly
      fireEvent.change(searchInput, { target: { value: '테스트병원' } });

      // Should only call search once after debounce delay
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });
  });

  describe('Organization Creation Functionality', () => {
    it('should validate organization name before submission', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      expect(screen.getByText(/조직 이름을 입력해주세요/i)).toBeInTheDocument();
    });

    it('should reject organization name shorter than 2 characters', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: 'A' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      expect(screen.getByText(/조직 이름은 2자 이상/i)).toBeInTheDocument();
    });

    it('should reject organization name longer than 100 characters', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      const longName = 'A'.repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      expect(screen.getByText(/조직 이름은.*100자 이하/i)).toBeInTheDocument();
    });

    it('should trim whitespace from organization name', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '  테스트병원  ' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      // Should accept trimmed name
      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      });
    });

    it('should create new organization with valid name', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '테스트병원' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalledWith('test-org-id');
      });
    });

    it('should show loading state during organization creation', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '테스트병원' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      expect(screen.getByText(/조직 생성 중/i)).toBeInTheDocument();
    });

    it('should handle duplicate organization name error', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '테스트병원' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/이미 존재하는 조직 이름입니다/i)).toBeInTheDocument();
      });
    });

    it('should handle organization creation errors gracefully', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: 'error' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/조직 생성 중 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });
  });

  describe('Join Request Functionality', () => {
    it('should create join request when existing organization selected', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: '테스트' } });

      await waitFor(() => {
        const orgButton = screen.getByText('테스트병원');
        fireEvent.click(orgButton);
      });

      const requestButton = screen.getByText(/가입 요청/i);
      fireEvent.click(requestButton);

      await waitFor(() => {
        expect(screen.getByText(/가입 요청이 전송되었습니다/i)).toBeInTheDocument();
      });
    });

    it('should show confirmation message after join request', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const joinButton = screen.getByText(/기존 조직 가입/i);
      fireEvent.click(joinButton);

      const searchInput = screen.getByPlaceholderText(/조직 이름으로 검색/i);
      fireEvent.change(searchInput, { target: { value: '테스트' } });

      await waitFor(() => {
        const orgButton = screen.getByText('테스트병원');
        fireEvent.click(orgButton);
      });

      const requestButton = screen.getByText(/가입 요청/i);
      fireEvent.click(requestButton);

      await waitFor(() => {
        expect(screen.getByText(/관리자 승인을 기다려주세요/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Signup Flow', () => {
    it('should call onComplete with organization_id after successful creation', async () => {
      const onComplete = vi.fn();
      render(<MockOrganizationSignupForm {...mockProps} onComplete={onComplete} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '테스트병원' } });

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('test-org-id');
      });
    });

    it('should display user information in the form', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      expect(screen.getByText(mockProps.userName)).toBeInTheDocument();
      expect(screen.getByText(mockProps.userEmail)).toBeInTheDocument();
    });

    it('should show appropriate role badge', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      expect(screen.getByText(/관리자/i)).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('should show helpful hint text for organization name', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      expect(screen.getByText(/병원 또는 클리닉의 이름을 입력하세요/i)).toBeInTheDocument();
    });

    it('should enable submit button only when valid input provided', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const submitButton = screen.getByText(/조직 생성/i);
      expect(submitButton).toBeDisabled();

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: '테스트병원' } });

      expect(submitButton).toBeEnabled();
    });

    it('should clear error message when user starts typing', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      expect(screen.getByText(/조직 이름을 입력해주세요/i)).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(/조직 이름 입력/i);
      fireEvent.change(nameInput, { target: { value: 'T' } });

      expect(screen.queryByText(/조직 이름을 입력해주세요/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createOption = screen.getByText(/새 조직 만들기/i);
      createOption.focus();

      expect(createOption).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      render(<MockOrganizationSignupForm {...mockProps} />);

      const createButton = screen.getByText(/새 조직 만들기/i);
      fireEvent.click(createButton);

      const submitButton = screen.getByText(/조직 생성/i);
      fireEvent.click(submitButton);

      const errorMessage = screen.getByText(/조직 이름을 입력해주세요/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });
});
