'use client';

import { useQuery } from '@tanstack/react-query';

interface SuperAdminStats {
  stats: {
    organizations: {
      total: number;
      active: number;
      inactive: number;
    };
    users: {
      total: number;
      by_role: {
        admin: number;
        doctor: number;
        nurse: number;
      };
    };
    join_requests: {
      pending: number;
      approved: number;
      rejected: number;
    };
  };
}

export function useSuperAdminStats() {
  return useQuery<SuperAdminStats>({
    queryKey: ['super-admin', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/stats');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '통계 조회 실패');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
