/**
 * Invitation Token Service
 *
 * Handles token generation and validation for invitation system.
 * Uses SHA-256 for token hashing to ensure security.
 */

import crypto from 'crypto';

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse';
  token: string;
  status: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  invited_by?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
}

export class TokenService {
  /**
   * Generate a cryptographically secure random token
   * Uses SHA-256 hash of random bytes for uniqueness
   * @returns 64-character hex string (SHA-256 hash)
   */
  generateInvitationToken(): string {
    // Generate 32 random bytes
    const randomBytes = crypto.randomBytes(32);

    // Hash with SHA-256 to produce 64-character hex string
    const hash = crypto.createHash('sha256');
    hash.update(randomBytes);
    hash.update(Date.now().toString()); // Add timestamp for extra uniqueness

    return hash.digest('hex');
  }

  /**
   * Check if a token has expired
   * @param expiresAt - Expiration date to check
   * @returns true if expired, false otherwise
   */
  isTokenExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() <= Date.now();
  }

  /**
   * Validate an invitation token
   * Checks status and expiration
   * @param invitation - Invitation object to validate
   * @returns Validation result with reason if invalid
   */
  validateToken(invitation: Invitation): TokenValidationResult {
    // Check if expired first (highest priority)
    if (this.isTokenExpired(invitation.expires_at)) {
      return {
        valid: false,
        reason: 'Token expired',
      };
    }

    // Check if already used
    if (invitation.status === 'accepted') {
      return {
        valid: false,
        reason: 'Token already used',
      };
    }

    // Check if cancelled
    if (invitation.status === 'cancelled') {
      return {
        valid: false,
        reason: 'Invitation cancelled',
      };
    }

    // Check if status is pending (only valid status)
    if (invitation.status !== 'pending') {
      return {
        valid: false,
        reason: `Invalid status: ${invitation.status}`,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Calculate expiry date for a new invitation
   * @param days - Number of days until expiry (default 7)
   * @returns Date object for expiry
   */
  calculateExpiryDate(days: number = 7): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  }
}

// Export singleton instance
export const tokenService = new TokenService();
