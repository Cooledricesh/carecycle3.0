'use client';

/**
 * Invitation Status Badge Component
 *
 * Displays the status of an invitation with appropriate color
 */

import { Badge } from '@/components/ui/badge';
import { getStatusBadgeVariant } from '@/lib/invitation-utils';

interface InvitationStatusBadgeProps {
  status: string;
}

export function InvitationStatusBadge({ status }: InvitationStatusBadgeProps) {
  const variant = getStatusBadgeVariant(status);

  const displayText = status.charAt(0).toUpperCase() + status.slice(1);

  return <Badge variant={variant}>{displayText}</Badge>;
}
