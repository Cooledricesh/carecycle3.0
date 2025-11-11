import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const policySchema = z.object({
  auto_hold_overdue_days: z.number().int().min(0).nullable(),
})

// GET /api/admin/organization-policies
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: policy } = await supabase
      .from('organization_policies')
      .select('*')
      .eq('organization_id', typedProfile.organization_id)
      .single()

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('GET /api/admin/organization-policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/organization-policies
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = policySchema.parse(body)

    const { data: policy, error } = await (supabase
      .from('organization_policies') as any)
      .insert({
        organization_id: typedProfile.organization_id,
        auto_hold_overdue_days: validatedData.auto_hold_overdue_days,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating policy:', error)
      return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 })
    }

    return NextResponse.json({ policy }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('POST /api/admin/organization-policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/organization-policies
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = policySchema.parse(body)

    const { data: policy, error } = await (supabase
      .from('organization_policies') as any)
      .update({
        auto_hold_overdue_days: validatedData.auto_hold_overdue_days,
      })
      .eq('organization_id', typedProfile.organization_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating policy:', error)
      return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
    }

    return NextResponse.json({ policy })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('PUT /api/admin/organization-policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/organization-policies
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Type assertion to help TypeScript understand the guard
    const typedProfile = profile as { role: string; organization_id: string }

    if (typedProfile.role !== 'admin' && typedProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('organization_policies')
      .delete()
      .eq('organization_id', typedProfile.organization_id)

    if (error) {
      console.error('Error deleting policy:', error)
      return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Policy deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/admin/organization-policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
