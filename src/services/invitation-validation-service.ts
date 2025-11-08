/**
 * Invitation Validation Service
 *
 * Pure functions for validating invitation operations.
 * These functions contain no side effects and are easily testable.
 */

export interface CancellationCheckResult {
  can: boolean;
  reason?: string;
}

/**
 * Check if an invitation can be cancelled
 * @param status - Current status of the invitation
 * @param expiresAt - Expiration date of the invitation
 * @returns Result indicating if cancellation is allowed
 */
export function canCancelInvitation(
  status: string,
  expiresAt: Date
): CancellationCheckResult {
  // Cannot cancel if already accepted
  if (status === 'accepted') {
    return {
      can: false,
      reason: 'Cannot cancel an accepted invitation',
    };
  }

  // Cannot cancel if already cancelled
  if (status === 'cancelled') {
    return {
      can: false,
      reason: 'Invitation is already cancelled',
    };
  }

  // Cannot cancel if already expired
  if (expiresAt.getTime() <= Date.now()) {
    return {
      can: false,
      reason: 'Cannot cancel an expired invitation',
    };
  }

  // Can cancel if status is pending and not expired
  if (status === 'pending') {
    return {
      can: true,
    };
  }

  // Invalid status
  return {
    can: false,
    reason: `Invalid invitation status: ${status}`,
  };
}
