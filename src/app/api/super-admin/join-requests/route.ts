import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/super-admin/join-requests
 *
 * Get all join requests across all organizations
 * Query params:
 *   - status: string (optional) - filter by status (pending, approved, rejected)
 *   - organization_id: string (optional) - filter by organization
 */
/**
 * Validates if a string is a valid UUID v4 format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export async function GET(request: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin();

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const organizationFilter = searchParams.get('organization_id');

    // Validate organization_id if provided
    if (organizationFilter && !isValidUUID(organizationFilter)) {
      return NextResponse.json(
        { error: 'Invalid organization_id format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('join_requests')
      .select(`
        id,
        email,
        name,
        organization_id,
        role,
        status,
        created_at,
        reviewed_at,
        reviewed_by,
        organizations (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (organizationFilter) {
      query = query.eq('organization_id', organizationFilter);
    }

    const { data: joinRequests, error } = await query;

    if (error) {
      console.error('Error fetching join requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to include organization_name
    const transformedRequests = (joinRequests || []).map((request: any) => {
      const org = Array.isArray(request.organizations)
        ? request.organizations[0]
        : request.organizations;

      return {
        id: request.id,
        email: request.email,
        name: request.name,
        organization_id: request.organization_id,
        organization_name: org?.name || null,
        role: request.role,
        status: request.status,
        created_at: request.created_at,
        reviewed_at: request.reviewed_at,
        reviewed_by: request.reviewed_by,
      };
    });

    return NextResponse.json({
      requests: transformedRequests,
      total: transformedRequests.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
