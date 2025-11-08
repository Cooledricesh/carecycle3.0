/**
 * Permission utility functions for role-based access control
 *
 * CRITICAL SECURITY NOTE:
 * - Super Admin can ONLY manage organizations and users
 * - Super Admin CANNOT access patient data (enforced by RLS + code)
 * - Organization Admin/Doctor/Nurse can access patient data
 */

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'nurse';

/**
 * Check if user has Super Admin role
 */
export const isSuperAdmin = (role: UserRole): boolean => {
  return role === 'super_admin';
};

/**
 * Check if user can manage organizations (create, update, delete)
 * Only Super Admin can manage organizations
 */
export const canManageOrganizations = (role: UserRole): boolean => {
  return role === 'super_admin';
};

/**
 * Check if user can access patient data
 * CRITICAL: Super Admin is explicitly excluded from patient data access
 */
export const canAccessPatientData = (role: UserRole): boolean => {
  return ['admin', 'doctor', 'nurse'].includes(role);
};

/**
 * Check if user can assign admin roles to other users
 * Only Super Admin can assign admin roles
 */
export const canAssignAdmin = (role: UserRole): boolean => {
  return role === 'super_admin';
};
