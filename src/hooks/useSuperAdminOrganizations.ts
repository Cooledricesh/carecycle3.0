'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
}

interface OrganizationsResponse {
  organizations: Organization[];
}

interface UseOrganizationsOptions {
  isActive?: boolean | null;
}

export function useSuperAdminOrganizations(options: UseOrganizationsOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery<OrganizationsResponse>({
    queryKey: ['super-admin', 'organizations', options.isActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.isActive !== null && options.isActive !== undefined) {
        params.set('is_active', String(options.isActive));
      }

      const response = await fetch(`/api/super-admin/organizations?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '조직 목록 조회 실패');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '조직 생성 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; is_active?: boolean }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/super-admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '조직 수정 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] });
    },
  });

  return {
    ...query,
    createOrganization: createMutation.mutateAsync,
    updateOrganization: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
