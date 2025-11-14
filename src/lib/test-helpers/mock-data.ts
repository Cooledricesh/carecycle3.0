/**
 * Test Helper - Mock Data Constants
 *
 * ⚠️ SECURITY NOTE: These are MOCK values for unit tests only.
 * These values are intentionally fake and used with mocked services.
 * Real authentication tests should use environment variables.
 *
 * GitGuardian note: These are test mocks, not real credentials.
 */

export const MOCK_TEST_DATA = {
  // Clearly fake email - using .test TLD which is reserved for testing
  email: 'mock-test-user@example.test',

  // Clearly fake password - obvious mock pattern
  password: 'MockTestPassword123!',

  // Additional mock user data
  name: '테스트유저',
  userId: 'mock-test-user-id-12345',
} as const;

/**
 * Helper function to generate unique mock emails for tests
 */
export function generateMockEmail(prefix = 'test'): string {
  return `mock-${prefix}-${Date.now()}@example.test`;
}

/**
 * Helper function to generate mock passwords
 */
export function generateMockPassword(): string {
  return `Mock${Date.now()}Test!`;
}
