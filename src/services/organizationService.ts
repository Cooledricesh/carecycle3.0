/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Organization Service
 *
 * Handles organization creation, search, and user registration.
 * Implements validation and business logic for organization management.
 */
// @ts-nocheck - Legacy service with complex type issues, needs refactoring

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Validates organization name
 * @param name - Organization name to validate
 * @returns Validation result with error message if invalid
 */
export function validateOrganizationName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmedName = name.trim();

  // Check for empty or whitespace-only names
  if (!trimmedName || trimmedName.length === 0) {
    return {
      valid: false,
      error: '조직 이름을 입력해주세요.',
    };
  }

  // Check for HTML/script tags (security)
  if (/<[^>]*>/.test(trimmedName)) {
    return {
      valid: false,
      error: '조직 이름에 HTML 태그를 사용할 수 없습니다.',
    };
  }

  // Check length constraints (2-100 characters)
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return {
      valid: false,
      error: '조직 이름은 2자 이상 100자 이하여야 합니다.',
    };
  }

  // Valid
  return { valid: true };
}

/**
 * Search for organizations by name (case-insensitive, partial matching)
 * @param supabase - Supabase client
 * @param query - Search query
 * @returns Organizations matching the query
 */
export async function searchOrganizations(
  supabase: SupabaseClient<Database>,
  query: string
): Promise<{
  data: Array<{ id: string; name: string }> | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', `%${query}%`);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create a new organization
 * @param supabase - Supabase client
 * @param name - Organization name
 * @returns Created organization data
 */
export async function createOrganization(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<{
  data: { id: string; name: string } | null;
  error: Error | null;
}> {
  try {
    // Validate name
    const validation = validateOrganizationName(name);
    if (!validation.valid) {
      return { data: null, error: new Error(validation.error) };
    }

    const trimmedName = name.trim();

    // Insert organization
    const { data, error } = await supabase
      .from('organizations')
      // @ts-expect-error - Supabase type inference issue with organizations table
      .insert({ name: trimmedName })
      .select('id, name')
      .single();

    if (error) {
      // Handle duplicate name error
      if (error.code === '23505') {
        return {
          data: null,
          error: new Error('이미 존재하는 조직 이름입니다.'),
        };
      }
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create organization and register user as first admin (atomic operation)
 * Uses RPC function for data consistency
 *
 * @param supabase - Supabase client
 * @param userId - User ID to register as admin
 * @param organizationName - Name of organization to create
 * @param userRole - Role to assign to user ('admin', 'doctor', 'nurse')
 * @returns Organization ID if successful
 */
export async function createOrganizationAndRegisterUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationName: string,
  userRole: string
): Promise<{
  data: { organization_id: string } | null;
  error: Error | null;
}> {
  try {
    // Validate organization name
    const validation = validateOrganizationName(organizationName);
    if (!validation.valid) {
      return { data: null, error: new Error(validation.error) };
    }

    // Validate user role
    const validRoles = ['admin', 'doctor', 'nurse'];
    if (!validRoles.includes(userRole)) {
      return {
        data: null,
        error: new Error('유효하지 않은 역할입니다. admin, doctor, nurse 중 하나여야 합니다.'),
      };
    }

    const trimmedName = organizationName.trim();

    // Call RPC function for atomic operation
    const { data, error } = await (supabase.rpc as any)(
      'create_organization_and_register_user',
      {
        p_user_id: userId,
        p_organization_name: trimmedName,
        p_user_role: userRole,
      }
    );

    if (error) {
      // Handle duplicate organization name
      if (error.message?.includes('duplicate') || error.code === '23505') {
        return {
          data: null,
          error: new Error('이미 존재하는 조직 이름입니다.'),
        };
      }
      return { data: null, error: new Error(error.message) };
    }

    // RPC function returns organization_id directly as a string
    // Wrap it in an object for consistent API
    const organizationId = typeof data === 'string' ? data : (data as any)?.organization_id || data;
    return { data: { organization_id: organizationId as string }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Sanitize organization name by removing potential injection attempts
 * @param name - Organization name to sanitize
 * @returns Sanitized name
 */
export function sanitizeOrganizationName(name: string): string {
  // Trim whitespace
  let sanitized = name.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized;
}

// Export as default service object
export const organizationService = {
  validateOrganizationName,
  searchOrganizations,
  createOrganization,
  createOrganizationAndRegisterUser,
  sanitizeOrganizationName,
};

export default organizationService;
