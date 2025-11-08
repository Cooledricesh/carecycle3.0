import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { updateUserRoleSchema } from '@/lib/validations/super-admin';

/**
 * PATCH /api/super-admin/users/[id]
 *
 * Update user role (assign/remove admin, change to doctor/nurse)
 * Body: { role: 'admin' | 'doctor' | 'nurse' }
 *
 * CRITICAL VALIDATION:
 * - Ensure at least 1 admin remains per organization
 * - Cannot assign super_admin role via API
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: superAdmin } = await requireSuperAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = updateUserRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { role: newRole } = validation.data;

    // Get current user data
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('*, organization_id, role')
      .eq('id', id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CRITICAL: If removing admin role, check minimum admin count
    if (targetUser.role === 'admin' && newRole !== 'admin') {
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', targetUser.organization_id)
        .eq('role', 'admin');

      if ((adminCount || 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove last admin from organization' },
          { status: 400 }
        );
      }
    }

    // Update user role
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create audit log
    const operation = newRole === 'admin' ? 'admin_assigned' : 'user_role_changed';
    await supabase.from('audit_logs').insert({
      organization_id: targetUser.organization_id,
      user_id: superAdmin.id,
      user_email: superAdmin.email,
      operation,
      table_name: 'profiles',
      record_id: id,
      old_values: { role: targetUser.role },
      new_values: { role: newRole },
    });

    return NextResponse.json({ user: updatedUser });
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
 * DELETE /api/super-admin/users/[id]
 *
 * Soft delete user (set is_active = false)
 * CRITICAL: Never perform hard delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: superAdmin } = await requireSuperAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    // Get user data
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('*, organization_id, role')
      .eq('id', id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CRITICAL: If user is admin, check minimum admin count
    if (targetUser.role === 'admin') {
      const { count: activeAdminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', targetUser.organization_id)
        .eq('role', 'admin')
        .eq('is_active', true);

      if ((activeAdminCount || 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate last admin from organization' },
          { status: 400 }
        );
      }
    }

    // Soft delete (set is_active = false)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      organization_id: targetUser.organization_id,
      user_id: superAdmin.id,
      user_email: superAdmin.email,
      operation: 'user_deactivated',
      table_name: 'profiles',
      record_id: id,
      old_values: { is_active: true },
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
