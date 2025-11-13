import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RejectRequestSchema = z.object({
  rejectionReason: z.string().max(500).optional(),
})

/**
 * POST /api/super-admin/organization-requests/[id]/reject
 * Reject organization registration request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify Super Admin access
    const { user } = await requireSuperAdmin()

    const supabase = await createServiceClient()
    const requestId = params.id

    // Parse request body
    const body = await request.json()
    const validation = RejectRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Call RPC to reject request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      'reject_org_request',
      {
        p_request_id: requestId,
        p_super_admin_id: user.id,
        p_rejection_reason: validation.data.rejectionReason || null,
      }
    ) as { data: { success: boolean; request_id: string; status: string } | null; error: Error | null }

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 }
      )
    }

    // TODO: Send rejection notification email

    return NextResponse.json({
      success: true,
      request_id: requestId,
      status: 'rejected',
    })
  } catch (error) {
    console.error('Rejection error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
