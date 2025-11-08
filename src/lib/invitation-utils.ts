/**
 * Invitation UI Utilities
 *
 * Pure functions for invitation UI logic
 */

/**
 * Calculate human-readable time until expiry
 * @param expiresAt - ISO string of expiration date
 * @returns Human-readable string (e.g., "2 days", "3 hours", "Expired")
 */
export function calculateTimeUntilExpiry(expiresAt: string): string {
  const now = Date.now();
  const expiryTime = new Date(expiresAt).getTime();
  const diff = expiryTime - now;

  // Already expired
  if (diff <= 0) {
    return 'Expired';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  return 'Less than 1 minute';
}

/**
 * Get status badge color based on invitation status
 * @param status - Invitation status
 * @returns Tailwind color class
 */
export function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'default'; // Blue/primary color
    case 'accepted':
      return 'secondary'; // Green
    case 'expired':
      return 'outline'; // Gray
    case 'cancelled':
      return 'destructive'; // Red
    default:
      return 'outline';
  }
}
