import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServiceClient()

    // Test 1: Get user by email
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'coolrice86@naver.com')
      .single()

    if (!profiles) {
      return NextResponse.json({ error: 'User not found' })
    }

    const userId = profiles.id
    console.log('[TEST API] User ID:', userId)

    // Profile is already fetched above
    const profile = profiles

    console.log('[TEST API] Profile:', profile)

    // Test 3: Direct RPC call
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_filtered_schedules', {
      p_user_id: userId,
      p_show_all: false,
      p_care_types: null,
      p_date_start: null,
      p_date_end: null
    })

    console.log('[TEST API] RPC Result:', {
      success: !rpcError,
      dataCount: rpcData?.length || 0,
      error: rpcError
    })

    // Test 4: Direct query with doctor filter
    const { data: directData, error: directError } = await supabase
      .from('schedules')
      .select(`
        id,
        patient_id,
        item_id,
        next_due_date,
        interval_weeks,
        status,
        notes,
        created_at,
        updated_at,
        patients!inner (
          name,
          care_type,
          patient_number
        ),
        items!inner (
          name,
          category
        )
      `)
      .eq('status', 'active')
      // Note: doctor_id column doesn't exist in current patients table

    console.log('[TEST API] Direct Query Result:', {
      success: !directError,
      dataCount: directData?.length || 0,
      error: directError,
      firstItem: directData?.[0]
    })

    // Test 5: Count all patients (doctor_id doesn't exist)
    const { count: patientCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      userId: userId,
      userEmail: profile?.email,
      profile: {
        role: profile?.role,
        care_type: profile?.care_type
      },
      rpc: {
        success: !rpcError,
        count: rpcData?.length || 0,
        error: rpcError?.message,
        sampleData: rpcData?.[0]
      },
      directQuery: {
        success: !directError,
        count: directData?.length || 0,
        error: directError?.message,
        sampleData: directData?.[0]
      },
      assignedPatients: patientCount
    })
  } catch (error: any) {
    console.error('[TEST API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}