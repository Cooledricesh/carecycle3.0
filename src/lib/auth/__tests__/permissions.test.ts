import { describe, it, expect } from 'vitest';
import {
  isSuperAdmin,
  canManageOrganizations,
  canAccessPatientData,
  canAssignAdmin,
} from '../permissions';

describe('Permission Utilities', () => {
  describe('isSuperAdmin', () => {
    it('should return true for super_admin role', () => {
      expect(isSuperAdmin('super_admin')).toBe(true);
    });

    it('should return false for admin role', () => {
      expect(isSuperAdmin('admin')).toBe(false);
    });

    it('should return false for doctor role', () => {
      expect(isSuperAdmin('doctor')).toBe(false);
    });

    it('should return false for nurse role', () => {
      expect(isSuperAdmin('nurse')).toBe(false);
    });
  });

  describe('canManageOrganizations', () => {
    it('should return true for super_admin role', () => {
      expect(canManageOrganizations('super_admin')).toBe(true);
    });

    it('should return false for admin role', () => {
      expect(canManageOrganizations('admin')).toBe(false);
    });

    it('should return false for doctor role', () => {
      expect(canManageOrganizations('doctor')).toBe(false);
    });

    it('should return false for nurse role', () => {
      expect(canManageOrganizations('nurse')).toBe(false);
    });
  });

  describe('canAccessPatientData', () => {
    it('should return false for super_admin role - CRITICAL SECURITY', () => {
      expect(canAccessPatientData('super_admin')).toBe(false);
    });

    it('should return true for admin role', () => {
      expect(canAccessPatientData('admin')).toBe(true);
    });

    it('should return true for doctor role', () => {
      expect(canAccessPatientData('doctor')).toBe(true);
    });

    it('should return true for nurse role', () => {
      expect(canAccessPatientData('nurse')).toBe(true);
    });
  });

  describe('canAssignAdmin', () => {
    it('should return true for super_admin role', () => {
      expect(canAssignAdmin('super_admin')).toBe(true);
    });

    it('should return false for admin role', () => {
      expect(canAssignAdmin('admin')).toBe(false);
    });

    it('should return false for doctor role', () => {
      expect(canAssignAdmin('doctor')).toBe(false);
    });

    it('should return false for nurse role', () => {
      expect(canAssignAdmin('nurse')).toBe(false);
    });
  });
});
