'use client'

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'

interface ApproveOrganizationVariables {
  requestId: string
}

interface ApproveOrganizationResponse {
  success: boolean
  organization_id: string
  request_id: string
}

/**
 * Approve organization registration request mutation
 */
export function useApproveOrganization(): UseMutationResult<
  ApproveOrganizationResponse,
  Error,
  ApproveOrganizationVariables
> {
  const queryClient = useQueryClient()

  return useMutation<ApproveOrganizationResponse, Error, ApproveOrganizationVariables>({
    mutationFn: async ({ requestId }) => {
      const response = await fetch(
        `/api/super-admin/organization-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve request')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate organization requests queries
      queryClient.invalidateQueries({ queryKey: ['organization-requests'] })

      // Invalidate organizations list
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

/**
 * Reject organization registration request mutation
 */
export function useRejectOrganization(): UseMutationResult<
  { success: boolean; request_id: string; status: string },
  Error,
  { requestId: string; rejectionReason?: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ requestId, rejectionReason }) => {
      const response = await fetch(
        `/api/super-admin/organization-requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rejectionReason }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject request')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate organization requests queries
      queryClient.invalidateQueries({ queryKey: ['organization-requests'] })
    },
  })
}
