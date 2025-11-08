import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { updateOrganizationSchema } from '@/lib/validations/super-admin';
import type { Database, Json } from '@/lib/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

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
      .select('id, name, email, role, is_active, created_at')
      .eq('organization_id', id);

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const org = organization as Organization;

    return NextResponse.json({
      organization: {
        ...org,
        users: (users as Partial<Profile>[]) || [],
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

    const oldOrg = oldOrganization as Organization;

    // Update organization
    const updateData: Database['public']['Tables']['organizations']['Update'] = validation.data;
    const { data: organization, error: updateError } = await (supabase as any)
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const org = organization as Organization;

    // Create audit log
    const auditLog: Database['public']['Tables']['audit_logs']['Insert'] = {
      organization_id: id,
      user_id: user.id,
      user_email: user.email ?? null,
      operation: validation.data.is_active === false ? 'organization_deactivated' : 'organization_updated',
      table_name: 'organizations',
      record_id: id,
      old_values: oldOrg as unknown as Json,
      new_values: validation.data as unknown as Json,
    };
    await (supabase as any).from('audit_logs').insert(auditLog);

    return NextResponse.json({ organization: org });
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

    const org = organization as Organization;

    // Soft delete (set is_active = false)
    const updateData: Database['public']['Tables']['organizations']['Update'] = { is_active: false };
    const { error: updateError } = await (supabase as any)
      .from('organizations')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create audit log
    const auditLog: Database['public']['Tables']['audit_logs']['Insert'] = {
      organization_id: id,
      user_id: user.id,
      user_email: user.email ?? null,
      operation: 'organization_deactivated',
      table_name: 'organizations',
      record_id: id,
      old_values: org as unknown as Json,
      new_values: { is_active: false } as unknown as Json,
    };
    await (supabase as any).from('audit_logs').insert(auditLog);

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
