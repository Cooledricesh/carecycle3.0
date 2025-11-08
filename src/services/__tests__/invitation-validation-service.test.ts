/**
 * Tests for Invitation Validation Service
 */

import { describe, it, expect } from 'vitest';
import { canCancelInvitation } from '../invitation-validation-service';

describe('canCancelInvitation', () => {
  describe('when invitation can be cancelled', () => {
    it('should allow cancelling a pending invitation that has not expired', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const result = canCancelInvitation('pending', futureDate);

      expect(result.can).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('when invitation cannot be cancelled', () => {
    it('should deny cancelling an accepted invitation', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = canCancelInvitation('accepted', futureDate);

      expect(result.can).toBe(false);
      expect(result.reason).toBe('Cannot cancel an accepted invitation');
    });

    it('should deny cancelling an already cancelled invitation', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = canCancelInvitation('cancelled', futureDate);

      expect(result.can).toBe(false);
      expect(result.reason).toBe('Invitation is already cancelled');
    });

    it('should deny cancelling an expired invitation', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const result = canCancelInvitation('pending', pastDate);

      expect(result.can).toBe(false);
      expect(result.reason).toBe('Cannot cancel an expired invitation');
    });

    it('should deny cancelling an invitation with invalid status', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = canCancelInvitation('invalid_status', futureDate);

      expect(result.can).toBe(false);
      expect(result.reason).toBe('Invalid invitation status: invalid_status');
    });
  });

  describe('edge cases', () => {
    it('should deny cancelling if expiration is exactly now', () => {
      const now = new Date();
      const result = canCancelInvitation('pending', now);

      expect(result.can).toBe(false);
      expect(result.reason).toBe('Cannot cancel an expired invitation');
    });

    it('should allow cancelling if expiration is 1ms in the future', () => {
      const almostExpired = new Date(Date.now() + 1);
      const result = canCancelInvitation('pending', almostExpired);

      expect(result.can).toBe(true);
    });
  });
});
