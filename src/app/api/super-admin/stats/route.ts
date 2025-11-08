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

    // Execute all count queries in parallel for better performance
    const [
      { count: totalOrganizations },
      { count: activeOrganizations },
      { count: totalUsers },
      { count: adminUsers },
      { count: doctorUsers },
      { count: nurseUsers },
      { count: pendingJoinRequests },
      { count: approvedJoinRequests },
      { count: rejectedJoinRequests },
    ] = await Promise.all([
      // Organization counts
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_active', true),

      // User counts by role
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'nurse'),

      // Join request counts
      supabase.from('join_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('join_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('join_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

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
