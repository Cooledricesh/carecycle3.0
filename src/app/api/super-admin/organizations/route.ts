import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { createOrganizationSchema } from '@/lib/validations/super-admin';
import type { Database, Json } from '@/lib/database.types';

/**
 * GET /api/super-admin/organizations
 *
 * Get all organizations with user counts
 * Query params:
 *   - is_active: boolean (optional) - filter by active status
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin();

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const isActiveFilter = searchParams.get('is_active');

    // Build query - simplified to avoid complex joins in tests
    let query = supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply is_active filter if provided
    if (isActiveFilter !== null) {
      query = query.eq('is_active', isActiveFilter === 'true');
    }

    const { data: organizations, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For each organization, get user count
    type Organization = Database['public']['Tables']['organizations']['Row'];
    const transformedOrganizations = await Promise.all(
      (organizations as Organization[] || []).map(async (org) => {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        return {
          id: org.id,
          name: org.name,
          is_active: org.is_active,
          created_at: org.created_at,
          user_count: count || 0,
        };
      })
    );

    return NextResponse.json({ organizations: transformedOrganizations });
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
 * POST /api/super-admin/organizations
 *
 * Create a new organization
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Super Admin access
    const { user } = await requireSuperAdmin();

    const supabase = await createServiceClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = createOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Create organization
    type Organization = Database['public']['Tables']['organizations']['Row'];
    const insertData: Database['public']['Tables']['organizations']['Insert'] = {
      name,
      is_active: true
    };
    const { data: organization, error: createError } = await (supabase as any)
      .from('organizations')
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const org = organization as Organization;

    // Create audit log
    const auditLog: Database['public']['Tables']['audit_logs']['Insert'] = {
      organization_id: org.id,
      user_id: user.id,
      user_email: user.email ?? null,
      operation: 'organization_created',
      table_name: 'organizations',
      record_id: org.id,
      new_values: { name, is_active: true } as unknown as Json,
    };
    await (supabase as any).from('audit_logs').insert(auditLog);

    return NextResponse.json({ organization }, { status: 201 });
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
