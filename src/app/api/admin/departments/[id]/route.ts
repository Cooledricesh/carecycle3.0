import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

/**
 * Common handler for department updates (used by both PUT and PATCH)
 * Implements partial update logic with validation and authorization
 */
async function handleUpdate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    // Check admin permission
    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateDepartmentSchema.parse(body)

    // Build update object
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.display_order !== undefined) updateData.display_order = validatedData.display_order
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active

    // Update department (RLS will ensure organization_id match)
    const { data: department, error } = await (supabase
      .from('departments') as any)
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', typedProfile.organization_id)
      .select()
      .maybeSingle()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'Department with this name already exists in your organization'
        }, { status: 409 })
      }

      console.error('Error updating department:', error)
      return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
    }

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({ department })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/departments/[id] - Update department (full update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, { params })
}

// PATCH /api/admin/departments/[id] - Update department (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, { params })
}

// DELETE /api/admin/departments/[id] - Delete department (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    // Check admin permission
    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    // Soft delete: set is_active = false (RLS will ensure organization_id match)
    const { data: department, error } = await (supabase
      .from('departments') as any)
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', typedProfile.organization_id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error deleting department:', error)
      return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
    }

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Department deleted successfully', department })
  } catch (error) {
    console.error('DELETE /api/admin/departments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
