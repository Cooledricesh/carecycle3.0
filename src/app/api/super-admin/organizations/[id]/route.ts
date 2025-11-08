import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { updateOrganizationSchema } from '@/lib/validations/super-admin';

/**
 * GET /api/super-admin/organizations/[id]
 *
 * Get organization details with user list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get users in organization
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, user_name, user_email, role, is_active, created_at')
      .eq('organization_id', id);

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    return NextResponse.json({
      organization: {
        ...organization,
        users: users || [],
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

/**
 * PATCH /api/super-admin/organizations/[id]
 *
 * Update organization (name, is_active)
 * Body: { name?: string, is_active?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireSuperAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = updateOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const { data: oldOrganization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Update organization
    const { data: organization, error: updateError } = await supabase
      .from('organizations')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      organization_id: id,
      user_id: user.id,
      user_email: user.email,
      operation: validation.data.is_active === false ? 'organization_deactivated' : 'organization_updated',
      table_name: 'organizations',
      record_id: id,
      old_values: oldOrganization,
      new_values: validation.data,
    });

    return NextResponse.json({ organization });
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

/**
 * DELETE /api/super-admin/organizations/[id]
 *
 * Soft delete organization (set is_active = false)
 * CRITICAL: Never perform hard delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireSuperAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    // Get organization for audit log
    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Soft delete (set is_active = false)
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      organization_id: id,
      user_id: user.id,
      user_email: user.email,
      operation: 'organization_deactivated',
      table_name: 'organizations',
      record_id: id,
      old_values: organization,
      new_values: { is_active: false },
    });

    return NextResponse.json({ success: true });
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
