'use client'

import { useQuery, UseQueryResult } from '@tanstack/react-query'

export interface OrganizationRequest {
  id: string
  organization_name: string
  organization_description: string | null
  requester_user_id: string
  requester_email: string
  requester_name: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_organization_id: string | null
  created_at: string
  updated_at: string
}

interface UseOrganizationRequestsOptions {
  status?: 'pending' | 'approved' | 'rejected' | null
}

interface OrganizationRequestsResponse {
  requests: OrganizationRequest[]
  total: number
}

/**
 * Fetch organization registration requests (Super Admin only)
 */
export function useOrganizationRequests(
  options: UseOrganizationRequestsOptions = {}
): UseQueryResult<OrganizationRequestsResponse, Error> {
  const { status } = options

  return useQuery<OrganizationRequestsResponse, Error>({
    queryKey: ['organization-requests', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) {
        params.append('status', status)
      }

      const response = await fetch(
        `/api/super-admin/organization-requests?${params.toString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch requests')
      }

      return response.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}
