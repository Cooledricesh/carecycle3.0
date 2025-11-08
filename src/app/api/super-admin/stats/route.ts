import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/super-admin/stats
 *
 * Get system-wide statistics for Super Admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const supabase = await createServiceClient();

    // Get organization counts
    const { count: totalOrganizations } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    const { count: activeOrganizations } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get user counts by role
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: adminUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    const { count: doctorUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'doctor');

    const { count: nurseUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'nurse');

    // Get join request counts
    const { count: pendingJoinRequests } = await supabase
      .from('join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: approvedJoinRequests } = await supabase
      .from('join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: rejectedJoinRequests } = await supabase
      .from('join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');

    return NextResponse.json({
      stats: {
        organizations: {
          total: totalOrganizations || 0,
          active: activeOrganizations || 0,
          inactive: (totalOrganizations || 0) - (activeOrganizations || 0),
        },
        users: {
          total: totalUsers || 0,
          by_role: {
            admin: adminUsers || 0,
            doctor: doctorUsers || 0,
            nurse: nurseUsers || 0,
          },
        },
        join_requests: {
          pending: pendingJoinRequests || 0,
          approved: approvedJoinRequests || 0,
          rejected: rejectedJoinRequests || 0,
        },
      },
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
