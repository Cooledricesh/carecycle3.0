/**
 * Signup Transformation Service
 *
 * Pure functions for transforming invitation data into signup data.
 */

export interface InvitationInfo {
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'super_admin';
  organization_id: string;
}

export interface SignupRequest {
  name: string;
  password: string;
}

export interface ProfileData {
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'super_admin';
  organization_id: string;
  approval_status: 'approved';
  name: string;
}

/**
 * Build profile data from invitation and signup request
 * @param invitation - Invitation information
 * @param signupRequest - Signup request data
 * @returns Profile data ready for database insertion
 */
export function buildProfileData(
  invitation: InvitationInfo,
  signupRequest: SignupRequest
): ProfileData {
  return {
    email: invitation.email,
    role: invitation.role,
    organization_id: invitation.organization_id,
    approval_status: 'approved' as const,
    name: signupRequest.name,
  };
}

/**
 * Validate signup request data
 * @param data - Signup request data to validate
 * @returns Validation result with error message if invalid
 */
export function validateSignupRequest(data: {
  name?: string;
  password?: string;
}): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Name is required',
    };
  }

  if (data.name.trim().length < 2) {
    return {
      valid: false,
      error: 'Name must be at least 2 characters',
    };
  }

  if (!data.password || data.password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters',
    };
  }

  return {
    valid: true,
  };
}
