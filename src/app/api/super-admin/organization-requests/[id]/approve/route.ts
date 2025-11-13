import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/super-admin/organization-requests/[id]/approve
 * Approve organization registration request
 *
 * @critical 원자적 트랜잭션 처리:
 * - Step 1: requireSuperAdmin() - Superadmin 권한 확인
 * - Step 2: organization_requests에서 요청 정보 가져오기
 * - Step 3: supabase.auth.admin.updateUserById - 사용자 계정 활성화 (email_confirm = true)
 * - Step 4: approve_org_request RPC 호출 - 단일 트랜잭션으로 기관 생성 및 프로필 업데이트
 * - Step 5: RPC 실패 시 Step 3 롤백 - 사용자를 다시 비활성화
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Verify Super Admin access
    const { user } = await requireSuperAdmin()

    const supabase = await createServiceClient()
    const { id: requestId } = await params

    // Step 2: Get request details
    const { data: orgRequest, error: fetchError } = await supabase
      .from('organization_requests')
      .select('*')
      .eq('id', requestId)
      .single<{
        id: string
        organization_name: string
        requester_user_id: string
        requester_email: string
        status: string
        user_metadata?: Record<string, unknown>
      }>()

    if (fetchError || !orgRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    if (orgRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 400 }
      )
    }

    // Step 3: Activate user account by confirming email
    const { data: updateUserData, error: updateUserError } = await supabase.auth.admin.updateUserById(
      orgRequest.requester_user_id,
      {
        email_confirm: true,
        user_metadata: {
          ...orgRequest.user_metadata,
          approval_status: 'approved',
        },
      }
    )

    if (updateUserError || !updateUserData.user) {
      console.error('Failed to activate user:', updateUserError)
      return NextResponse.json(
        { error: 'Failed to activate user account' },
        { status: 500 }
      )
    }

    // Step 4: Call RPC to approve request and create organization (atomic transaction)
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      'approve_org_request',
      {
        p_request_id: requestId,
        p_super_admin_id: user.id,
      }
    ) as { data: { organization_id: string } | null; error: Error | null }

    if (rpcError) {
      // Step 5: Rollback - Deactivate user again
      console.error('RPC error, rolling back user activation:', rpcError)

      await supabase.auth.admin.updateUserById(
        orgRequest.requester_user_id,
        {
          email_confirm: false,
          user_metadata: {
            ...orgRequest.user_metadata,
            approval_status: 'pending_organization',
          },
        }
      )

      return NextResponse.json(
        { error: rpcError.message || 'Failed to approve request' },
        { status: 500 }
      )
    }

    // TODO: Send approval notification email

    return NextResponse.json({
      success: true,
      organization_id: rpcResult?.organization_id,
      request_id: requestId,
    })
  } catch (error) {
    console.error('Approval error:', error)
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
