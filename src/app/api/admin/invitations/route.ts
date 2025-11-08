/**
 * Admin Invitations API
 *
 * POST /api/admin/invitations - Create new invitation
 * GET /api/admin/invitations - List invitations
 *
 * Requirements:
 * - Only admin and super_admin can access
 * - Validates email and role
 * - Checks for duplicates and existing users
 * - Generates secure token with 7-day expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tokenService } from '@/services/invitation-token-service';
import { z } from 'zod';
import type { UserRole } from '@/lib/database.types';

// Validation schema
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.enum(['admin', 'doctor', 'nurse'], {
    errorMap: () => ({ message: 'Invalid role. Must be admin, doctor, or nurse' }),
  }),
  care_type: z.enum(['외래', '입원', '낮병원']).optional(),
}).refine((data) => {
  // nurse 역할인 경우 care_type 필수
  if (data.role === 'nurse') {
    return data.care_type !== undefined;
  }
  // admin/doctor 역할인 경우 care_type이 없어야 함
  if (data.role === 'admin' || data.role === 'doctor') {
    return data.care_type === undefined;
  }
  return true;
}, {
  message: 'Nurse role requires care_type, admin/doctor must not have care_type',
  path: ['care_type'],
});

// Type for profile data
type ProfileData = {
  id: string;
  organization_id: string | null;
  role: UserRole;
};

/**
 * POST /api/admin/invitations
 * Create a new invitation
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = createInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error.errors[0]?.message}` },
        { status: 400 }
      );
    }

    const { email, role, care_type } = validation.data;

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Not authenticated' },
        { status: 401 }
      );
    }

    // Get user profile and verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Type assertion for profile data
    const userProfile = profile as ProfileData;

    // Check if user is admin or super_admin
    if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Check organization_id exists
    if (!userProfile.organization_id) {
      return NextResponse.json(
        { error: 'User does not belong to an organization' },
        { status: 403 }
      );
    }

    // Check for existing invitation
    const { data: existingInvitations } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('organization_id', userProfile.organization_id!)
      .eq('status', 'pending');

    if (existingInvitations && existingInvitations.length > 0) {
      return NextResponse.json(
        { error: 'User already invited to this organization' },
        { status: 409 }
      );
    }

    // Check if email already registered
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered in the system' },
        { status: 409 }
      );
    }

    // Generate token and calculate expiry
    const token = tokenService.generateInvitationToken();
    const expiresAt = tokenService.calculateExpiryDate(7);

    // Create invitation
    const invitationPayload: any = {
      organization_id: userProfile.organization_id,
      email,
      role,
      token,
      status: 'pending' as const,
      expires_at: expiresAt.toISOString(),
      invited_by: user.id,
    };

    // Add care_type for nurse role
    if (role === 'nurse' && care_type) {
      invitationPayload.care_type = care_type;
    }

    const { data: invitation, error: insertError } = await supabase
      .from('invitations')
      .insert(invitationPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create invitation:', insertError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/admin/invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/invitations
 * List all invitations for the admin's organization
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Not authenticated' },
        { status: 401 }
      );
    }

    // Get user profile and verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Type assertion for profile data
    const userProfile = profile as ProfileData;

    // Check if user is admin or super_admin
    if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Check organization_id exists
    if (!userProfile.organization_id) {
      return NextResponse.json(
        { error: 'User does not belong to an organization' },
        { status: 403 }
      );
    }

    // Build query
    let query = supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: invitations, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch invitations:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      );
    }

    return NextResponse.json(invitations, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
