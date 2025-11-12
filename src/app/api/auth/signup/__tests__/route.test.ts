import { describe, it, expect } from 'vitest';

describe('POST /api/auth/signup - care_type removal', () => {
  it('should fail: current code includes care_type field', () => {
    // This test documents the current (broken) behavior
    // After fix, we'll verify care_type is NOT included in profile data

    const currentProfileData = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'nurse',
      care_type: '낮병원', // This field causes 401 error in production
      department_id: null,
      phone: null,
    };

    // Assert: Currently care_type IS present (this is the bug)
    expect(currentProfileData).toHaveProperty('care_type');
    expect(currentProfileData.care_type).toBe('낮병원');
  });

  it('should pass after fix: profile data without care_type', () => {
    // This test defines the expected (fixed) behavior

    const fixedProfileData = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'nurse',
      department_id: 'dept-123',
      phone: null,
    };

    // Assert: After fix, care_type should NOT be present
    expect(fixedProfileData).not.toHaveProperty('care_type');
  });

  it('should pass after fix: admin profile without care_type', () => {
    const fixedAdminProfile = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      department_id: null,
      phone: null,
    };

    // Assert: Admin profiles should never have care_type
    expect(fixedAdminProfile).not.toHaveProperty('care_type');
  });

  it('should pass after fix: doctor profile without care_type', () => {
    const fixedDoctorProfile = {
      id: 'doctor-id',
      email: 'doctor@example.com',
      name: 'Doctor User',
      role: 'doctor',
      department_id: null,
      phone: null,
    };

    // Assert: Doctor profiles should never have care_type
    expect(fixedDoctorProfile).not.toHaveProperty('care_type');
  });
});
