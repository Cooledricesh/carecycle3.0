/**
 * Signup with Invitation API
 *
 * POST /api/auth/signup/with-invitation - Create account using invitation token
 *
 * Requirements:
 * - Public endpoint (no authentication required)
 * - Validates token is valid and not expired
 * - Creates Supabase Auth user
 * - Creates profile with approved status
 * - Adds organization membership
 * - Marks invitation as accepted
 * - Transaction-like behavior (rollback on failure)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { tokenService, type Invitation } from '@/services/invitation-token-service';
import {
  buildProfileData,
  type InvitationInfo,
} from '@/services/signup-transformation-service';
import { z } from 'zod';

// Validation schema
const signupSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

/**
 * POST /api/auth/signup/with-invitation
 * Create a new user account using an invitation token
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Signup] Starting signup process');

    // Parse and validate request body
    const body = await request.json();
    console.log('[Signup] Request body received:', { token: body.token?.substring(0, 10) + '...', name: body.name });

    const validation = signupSchema.safeParse(body);

    if (!validation.success) {
      console.error('[Signup] Validation failed:', validation.error.errors);
      return NextResponse.json(
        { error: `Validation error: ${validation.error.errors[0]?.message}` },
        { status: 400 }
      );
    }

    const { token, password, name } = validation.data;
    console.log('[Signup] Validation passed');

    // Use service client for database operations (public endpoint)
    const supabase = await createServiceClient();

    // Find invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
    }

    // Type assertion for invitation data - explicitly include care_type
    const invitationData = invitation as (Invitation & { care_type: string | null });

    // Validate token using TokenService
    const validationResult = tokenService.validateToken({
      ...invitationData,
      expires_at: new Date(invitationData.expires_at),
      created_at: new Date(invitationData.created_at),
      updated_at: new Date(invitationData.updated_at),
    });

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: `Invitation is not valid: ${validationResult.reason}` },
        { status: 400 }
      );
    }

    // Check if email is already registered in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', invitationData.email)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Email is already registered. Please login instead.' },
        { status: 409 }
      );
    }

    // Validate nurse role has care_type and convert to department_id
    let departmentId: string | null = null;

    if (invitationData.role === 'nurse') {
      if (!invitationData.care_type) {
        console.error('[Signup] Nurse invitation missing care_type');
        return NextResponse.json(
          { error: 'Nurse invitation must have care_type' },
          { status: 400 }
        );
      }

      // Find department_id from care_type
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .eq('name', invitationData.care_type)
        .eq('organization_id', invitationData.organization_id)
        .single<{ id: string }>();

      if (deptError || !department) {
        console.error('[Signup] Failed to find department:', deptError);
        return NextResponse.json(
          { error: `Department not found for care_type: ${invitationData.care_type}` },
          { status: 400 }
        );
      }

      departmentId = department.id;
      console.log(`[Signup] Mapped care_type "${invitationData.care_type}" to department_id: ${departmentId}`);
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitationData.email,
      password: password,
      email_confirm: true, // Auto-confirm email for invited users
    });

    if (authError || !authData.user) {
      console.error('Failed to create auth user:', authError);

      // Provide more specific error message for email_exists
      if (authError?.message?.includes('already been registered') || authError?.status === 422) {
        return NextResponse.json({
          error: 'This email address is already registered. Please try logging in instead.',
          code: 'email_exists'
        }, { status: 422 });
      }

      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
    }

    const userId = authData.user.id;

    // Build profile data using pure function
    // Note: care_type is no longer used - we use department_id instead
    const invitationInfo: InvitationInfo = {
      email: invitationData.email,
      role: invitationData.role as 'admin' | 'doctor' | 'nurse' | 'super_admin',
      organization_id: invitationData.organization_id,
    };

    const profileData = buildProfileData(invitationInfo, { name, password });

    // Create profile
    // Note: department_id is required for nurses, NULL for admin/doctor/super_admin
    const profilePayload: any = {
      id: userId,
      email: profileData.email,
      role: profileData.role,
      organization_id: profileData.organization_id,
      approval_status: profileData.approval_status,
      name: profileData.name,
      is_active: true,
      department_id: departmentId,
    };

    console.log('[Signup] Upserting profile with payload:', JSON.stringify(profilePayload, null, 2));

    // Use UPSERT because handle_new_user trigger auto-creates profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (profileError) {
      console.error('[Signup] Failed to upsert profile. Error details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
      });

      // Rollback: Delete auth user
      await supabase.auth.admin.deleteUser(userId);

      return NextResponse.json({
        error: 'Failed to create user profile',
        details: profileError.message
      }, { status: 500 });
    }

    console.log('[Signup] Profile upserted successfully');

    // Note: organization_id is already stored in the profile, no separate membership table needed

    // Mark invitation as accepted
    const updatePayload = {
      status: 'accepted',
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('invitations')
      // @ts-expect-error - Supabase type inference issue with update
      .update(updatePayload)
      .eq('id', invitationData.id);

    if (updateError) {
      console.error('Failed to update invitation status:', updateError);
      // Note: We don't rollback here as the user is already created successfully
      // The invitation will remain in pending state, which is acceptable
    }

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: userId,
          email: authData.user.email,
          name: name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/auth/signup/with-invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
