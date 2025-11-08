import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for department creation
const createDepartmentSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  display_order: z.number().int().default(0),
})

// Validation schema for department update
const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

// GET /api/admin/departments - List departments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role and organization
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

    // Check if user is admin or super_admin
    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    // Fetch departments for user's organization
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', typedProfile.organization_id)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching departments:', error)
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
    }

    return NextResponse.json({ departments })
  } catch (error) {
    console.error('GET /api/admin/departments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/departments - Create department
export async function POST(request: NextRequest) {
  try {
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
    const validatedData = createDepartmentSchema.parse(body)

    // Create department
    const { data: department, error } = await (supabase
      .from('departments') as any)
      .insert({
        name: validatedData.name,
        description: validatedData.description || null,
        display_order: validatedData.display_order,
        organization_id: typedProfile.organization_id,
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'Department with this name already exists in your organization'
        }, { status: 409 })
      }

      console.error('Error creating department:', error)
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
    }

    return NextResponse.json({ department }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('POST /api/admin/departments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
