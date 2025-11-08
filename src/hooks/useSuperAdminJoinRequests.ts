'use client';

import { useQuery } from '@tanstack/react-query';

interface JoinRequest {
  id: string;
  organization_id: string;
  organization_name?: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface JoinRequestsResponse {
  requests: JoinRequest[];
  total: number;
}

interface UseJoinRequestsOptions {
  status?: 'pending' | 'approved' | 'rejected' | null;
  organizationId?: string | null;
}

export function useSuperAdminJoinRequests(options: UseJoinRequestsOptions = {}) {
  return useQuery<JoinRequestsResponse>({
    queryKey: ['super-admin', 'join-requests', options.status, options.organizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.status) {
        params.set('status', options.status);
      }
      if (options.organizationId) {
        params.set('organization_id', options.organizationId);
      }

      const response = await fetch(`/api/super-admin/join-requests?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '가입 요청 조회 실패');
      }

      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute - join requests update more frequently
    refetchInterval: 60 * 1000, // Refetch every minute for pending requests
  });
}
