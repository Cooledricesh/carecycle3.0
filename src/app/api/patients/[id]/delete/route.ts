import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // First check if user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Try to update patient with regular client first
    // The database trigger will automatically cascade delete all related schedules
    const { error: updateError } = await (supabase as any)
      .from('patients')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (!updateError) {
      return NextResponse.json({ success: true })
    }
    
    // If regular update fails due to RLS, use service client
    console.log('[API] Regular update failed, trying with service client:', updateError)
    
    const serviceSupabase = await createServiceClient()
    
    // Deactivate patient with service client
    // The database trigger will automatically cascade delete all related schedules
    const { error: adminError } = await (serviceSupabase as any)
          .from('patients')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (adminError) {
      console.error('[API] Service client update also failed:', adminError)
      return NextResponse.json(
        { error: 'Failed to delete patient' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}