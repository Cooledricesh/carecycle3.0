/**
 * Admin Invitation Management API
 *
 * DELETE /api/admin/invitations/[id] - Cancel an invitation
 *
 * Requirements:
 * - Only admin and super_admin can access
 * - Can only cancel invitations from their own organization
 * - Cannot cancel accepted, expired, or already cancelled invitations
 * - Hard delete - permanently removes the invitation from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { canCancelInvitation } from '@/services/invitation-validation-service';
import type { UserRole, InvitationUpdate } from '@/lib/database.types';

// Type for profile data
type ProfileData = {
  id: string;
  organization_id: string | null;
  role: UserRole;
};

// Type for invitation data
type InvitationData = {
  id: string;
  organization_id: string;
  status: string;
  expires_at: string;
};

/**
 * DELETE /api/admin/invitations/[id]
 * Cancel an existing invitation (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID parameter
    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Not authenticated' }, { status: 401 });
    }

    // Get user profile and verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    // Type assertion for profile data
    const userProfile = profile as ProfileData;

    // Check if user is admin or super_admin
    if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Check organization_id exists
    if (!userProfile.organization_id) {
      return NextResponse.json(
        { error: 'User does not belong to an organization' },
        { status: 403 }
      );
    }

    // Fetch invitation to verify ownership and status
    const { data: invitation, error: fetchError } = await supabase
      .from('invitations')
      .select('id, organization_id, status, expires_at')
      .eq('id', id)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Type assertion for invitation data
    const invitationData = invitation as InvitationData;

    // Verify invitation belongs to user's organization
    if (invitationData.organization_id !== userProfile.organization_id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot cancel invitations from other organizations' },
        { status: 403 }
      );
    }

    // Validate if invitation can be cancelled using pure function
    const validationResult = canCancelInvitation(
      invitationData.status,
      new Date(invitationData.expires_at)
    );

    if (!validationResult.can) {
      return NextResponse.json({ error: validationResult.reason }, { status: 400 });
    }

    // Hard delete - permanently remove invitation from database
    console.log('[DELETE Invitation] Attempting to delete invitation:', id);
    console.log('[DELETE Invitation] User:', user.id, 'Organization:', userProfile.organization_id);

    // Use service client to bypass RLS policies for delete operation
    const serviceSupabase = await createServiceClient();
    const { data: deletedData, error: deleteError } = await serviceSupabase
      .from('invitations')
      .delete()
      .eq('id', id)
      .select();

    console.log('[DELETE Invitation] Delete result:', { deletedData, deleteError });

    if (deleteError) {
      console.error('[DELETE Invitation] Failed to delete invitation:', deleteError);
      return NextResponse.json({
        error: 'Failed to delete invitation',
        details: deleteError.message
      }, { status: 500 });
    }

    if (!deletedData || deletedData.length === 0) {
      console.warn('[DELETE Invitation] No rows deleted - possible RLS policy blocking');
      return NextResponse.json({
        error: 'Failed to delete invitation - no rows affected (RLS policy may be blocking)',
        hint: 'Check RLS policies on invitations table'
      }, { status: 500 });
    }

    console.log('[DELETE Invitation] Successfully deleted:', deletedData);
    return NextResponse.json(
      { message: 'Invitation deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/invitations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
