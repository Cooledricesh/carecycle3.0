'use client';

/**
 * Invite User Button Component
 *
 * Button that opens the invite user modal
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { InviteUserModal } from './InviteUserModal';

export function InviteUserButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsModalOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        사용자 초대
      </Button>

      <InviteUserModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
