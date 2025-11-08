import { z } from 'zod';

/**
 * Validation schemas for Super Admin operations
 *
 * These schemas ensure:
 * - Organization data integrity
 * - User role assignment constraints
 * - Input validation for API endpoints
 */

/**
 * Schema for creating a new organization
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Organization name must be 100 characters or less'),
});

/**
 * Schema for updating an organization
 * All fields are optional
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name cannot be empty').max(100, 'Organization name must be 100 characters or less').optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for updating user role
 * Note: super_admin role cannot be assigned via API
 * Super Admin role must be assigned directly in database
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'doctor', 'nurse'], {
    errorMap: () => ({ message: 'Role must be admin, doctor, or nurse' }),
  }),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
