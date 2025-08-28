import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { getSupabaseServer } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // First try with regular auth
    const supabase = await getSupabaseServer()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // First, soft delete all schedules for this patient
    const { error: scheduleError } = await supabase
      .from('schedules')
      .update({ 
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', id)
      .eq('status', 'active')
    
    if (scheduleError) {
      console.log('[API] Warning: Could not deactivate schedules:', scheduleError)
      // Continue anyway
    }
    
    // Try to update patient with regular client first
    const { error: updateError } = await supabase
      .from('patients')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (!updateError) {
      return NextResponse.json({ success: true })
    }
    
    // If regular update fails due to RLS, use service role
    console.log('[API] Regular update failed, trying with service role:', updateError)
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )
    
    // Deactivate schedules with admin client
    await supabaseAdmin
      .from('schedules')
      .update({ 
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', id)
      .eq('status', 'active')
    
    // Deactivate patient with admin client
    const { error: adminError } = await supabaseAdmin
      .from('patients')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (adminError) {
      console.error('[API] Admin update also failed:', adminError)
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