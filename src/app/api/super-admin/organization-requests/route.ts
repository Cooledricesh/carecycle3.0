import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/super-admin/organization-requests
 * Get all organization registration requests
 * Query params:
 *   - status: string (optional) - filter by status (pending, approved, rejected)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin()

    const supabase = await createServiceClient()
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Build query
    let query = supabase
      .from('organization_requests')
      .select(`
        id,
        organization_name,
        organization_description,
        requester_user_id,
        requester_email,
        requester_name,
        status,
        rejection_reason,
        reviewed_by,
        reviewed_at,
        created_organization_id,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Error fetching organization requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: requests || [],
      total: requests?.length || 0,
    })
  } catch (error) {
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
