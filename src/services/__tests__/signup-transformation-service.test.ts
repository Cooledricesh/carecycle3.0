/**
 * Tests for Signup Transformation Service
 */

import { describe, it, expect } from 'vitest';
import {
  buildProfileData,
  validateSignupRequest,
  type InvitationInfo,
  type SignupRequest,
} from '../signup-transformation-service';

describe('buildProfileData', () => {
  it('should correctly transform invitation and signup data into profile data', () => {
    const invitation: InvitationInfo = {
      email: 'test@example.com',
      role: 'doctor',
      organization_id: 'org-123',
    };

    const signupRequest: SignupRequest = {
      name: 'John Doe',
      password: 'password123', // Password is not included in profile data
    };

    const result = buildProfileData(invitation, signupRequest);

    expect(result).toEqual({
      email: 'test@example.com',
      role: 'doctor',
      organization_id: 'org-123',
      approval_status: 'approved',
      name: 'John Doe',
    });
  });

  it('should set approval_status to approved for all roles', () => {
    const invitation: InvitationInfo = {
      email: 'nurse@example.com',
      role: 'nurse',
      organization_id: 'org-456',
    };

    const signupRequest: SignupRequest = {
      name: 'Jane Smith',
      password: 'password123',
    };

    const result = buildProfileData(invitation, signupRequest);

    expect(result.approval_status).toBe('approved');
  });

  it('should preserve all invitation data', () => {
    const invitation: InvitationInfo = {
      email: 'admin@example.com',
      role: 'admin',
      organization_id: 'org-789',
    };

    const signupRequest: SignupRequest = {
      name: 'Admin User',
      password: 'securepass',
    };

    const result = buildProfileData(invitation, signupRequest);

    expect(result.email).toBe(invitation.email);
    expect(result.role).toBe(invitation.role);
    expect(result.organization_id).toBe(invitation.organization_id);
  });
});

describe('validateSignupRequest', () => {
  describe('valid requests', () => {
    it('should accept valid name and password', () => {
      const result = validateSignupRequest({
        name: 'John Doe',
        password: 'password123',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept minimum valid inputs', () => {
      const result = validateSignupRequest({
        name: 'Jo',
        password: '123456',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('invalid name', () => {
    it('should reject missing name', () => {
      const result = validateSignupRequest({
        password: 'password123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject empty name', () => {
      const result = validateSignupRequest({
        name: '',
        password: 'password123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject whitespace-only name', () => {
      const result = validateSignupRequest({
        name: '   ',
        password: 'password123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject name shorter than 2 characters', () => {
      const result = validateSignupRequest({
        name: 'J',
        password: 'password123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters');
    });
  });

  describe('invalid password', () => {
    it('should reject missing password', () => {
      const result = validateSignupRequest({
        name: 'John Doe',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters');
    });

    it('should reject empty password', () => {
      const result = validateSignupRequest({
        name: 'John Doe',
        password: '',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters');
    });

    it('should reject password shorter than 6 characters', () => {
      const result = validateSignupRequest({
        name: 'John Doe',
        password: '12345',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters');
    });
  });
});
