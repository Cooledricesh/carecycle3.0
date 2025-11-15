import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define validation schema for user updates
const UserUpdateSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: z.enum(['admin', 'nurse', 'doctor'], {
    errorMap: () => ({ message: 'Role must be admin, nurse, or doctor' })
  }).optional(),
  department_id: z.string().uuid('Invalid department ID format').nullable().optional()
});

export async function POST(request: NextRequest) {
  try {
    // First, verify the current user is an admin
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the current user is an admin
    const { data: currentProfile } = await (userClient as any)
          .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (currentProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = UserUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input data',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const { userId, role, department_id } = validationResult.data;

    // Prevent admins from changing their own role
    if (userId === user.id && role !== undefined) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) {
      updateData.role = role;
    }

    if (department_id !== undefined) {
      updateData.department_id = department_id;
    }

    // Use service client to bypass RLS for admin operations
    const serviceClient = await createServiceClient();

    const { data, error } = await (serviceClient as any)
          .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json({
        error: error.message || 'Failed to update user'
      }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}