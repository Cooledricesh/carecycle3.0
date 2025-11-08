import { describe, it, expect } from 'vitest';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateUserRoleSchema,
} from '../super-admin';

describe('Super Admin Validation Schemas', () => {
  describe('createOrganizationSchema', () => {
    it('should accept valid organization name', () => {
      const result = createOrganizationSchema.safeParse({
        name: 'Test Organization',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createOrganizationSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name exceeding 100 characters', () => {
      const result = createOrganizationSchema.safeParse({
        name: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = createOrganizationSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateOrganizationSchema', () => {
    it('should accept valid name update', () => {
      const result = updateOrganizationSchema.safeParse({
        name: 'Updated Organization',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid is_active update', () => {
      const result = updateOrganizationSchema.safeParse({
        is_active: false,
      });
      expect(result.success).toBe(true);
    });

    it('should accept both name and is_active', () => {
      const result = updateOrganizationSchema.safeParse({
        name: 'Updated Organization',
        is_active: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all fields optional)', () => {
      const result = updateOrganizationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty name string', () => {
      const result = updateOrganizationSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name exceeding 100 characters', () => {
      const result = updateOrganizationSchema.safeParse({
        name: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean is_active', () => {
      const result = updateOrganizationSchema.safeParse({
        is_active: 'true',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserRoleSchema', () => {
    it('should accept admin role', () => {
      const result = updateUserRoleSchema.safeParse({
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should accept doctor role', () => {
      const result = updateUserRoleSchema.safeParse({
        role: 'doctor',
      });
      expect(result.success).toBe(true);
    });

    it('should accept nurse role', () => {
      const result = updateUserRoleSchema.safeParse({
        role: 'nurse',
      });
      expect(result.success).toBe(true);
    });

    it('should reject super_admin role - only via direct DB update', () => {
      const result = updateUserRoleSchema.safeParse({
        role: 'super_admin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = updateUserRoleSchema.safeParse({
        role: 'invalid_role',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing role', () => {
      const result = updateUserRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
