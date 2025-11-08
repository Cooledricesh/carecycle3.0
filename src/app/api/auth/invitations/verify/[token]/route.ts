/**
 * Invitation Token Verification API
 *
 * GET /api/auth/invitations/verify/[token] - Verify invitation token
 *
 * Requirements:
 * - Public endpoint (no authentication required)
 * - Validates token and returns invitation details if valid
 * - Returns reason if invalid (expired, cancelled, accepted, not found)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { tokenService, type Invitation } from '@/services/invitation-token-service';

interface VerificationResponse {
  valid: boolean;
  email?: string;
  role?: string;
  organization_name?: string;
  reason?: string;
}

/**
 * GET /api/auth/invitations/verify/[token]
 * Verify if an invitation token is valid and return details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token parameter
    if (!token || token.length === 0) {
      const response: VerificationResponse = {
        valid: false,
        reason: 'Token is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Use service client to query invitation (public endpoint needs service role)
    const supabase = await createServiceClient();

    // Find invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from('invitations')
      .select(
        `
        id,
        email,
        role,
        status,
        expires_at,
        organization_id,
        organizations (
          name
        )
      `
      )
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      const response: VerificationResponse = {
        valid: false,
        reason: 'Invalid token',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Type assertion for invitation data
    const invitationData = invitation as Invitation & {
      organizations: { name: string } | null;
    };

    // Validate token using TokenService
    const validationResult = tokenService.validateToken({
      ...invitationData,
      expires_at: new Date(invitationData.expires_at),
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (!validationResult.valid) {
      const response: VerificationResponse = {
        valid: false,
        reason: validationResult.reason,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Return valid response with invitation details
    const response: VerificationResponse = {
      valid: true,
      email: invitationData.email,
      role: invitationData.role,
      organization_name: invitationData.organizations?.name ?? 'Unknown Organization',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in GET /api/auth/invitations/verify/[token]:', error);
    const response: VerificationResponse = {
      valid: false,
      reason: 'Internal server error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
