import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PatientCreateSchema } from '@/schemas/patient'
import { toCamelCase } from '@/lib/database-utils'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // First, verify the user is authenticated
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    
    // Check user's approval status
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('approval_status, role, is_active')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('[API /patients] Profile fetch error:', profileError)
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 403 }
      )
    }
    
    // Verify user is approved and active
    if (profile.approval_status !== 'approved' || !profile.is_active) {
      return NextResponse.json(
        { error: '승인된 사용자만 환자를 등록할 수 있습니다.' },
        { status: 403 }
      )
    }
    
    // Parse and validate the request body
    const body = await request.json()
    const validated = PatientCreateSchema.parse(body)
    
    // Prepare insert data
    const insertData = {
      name: validated.name,
      patient_number: validated.patientNumber,
      care_type: validated.careType || null,
      is_active: validated.isActive ?? true,
      metadata: validated.metadata || {},
      // Add audit fields
      created_by: user.id,
      created_at: new Date().toISOString()
    }
    
    console.log('[API /patients] Creating patient with service role:', {
      userId: user.id,
      userRole: profile.role,
      patientNumber: insertData.patient_number
    })
    
    // Use service role client to bypass RLS
    const supabaseServiceRole = await createServiceClient()
    
    // Check for duplicate patient number
    const { data: existing } = await supabaseServiceRole
      .from('patients')
      .select('id')
      .eq('patient_number', insertData.patient_number)
      .eq('is_active', true)
      .single()
    
    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 환자번호입니다.' },
        { status: 409 }
      )
    }
    
    // Insert the patient
    const { data, error } = await supabaseServiceRole
      .from('patients')
      .insert(insertData)
      .select()
      .single()
    
    if (error) {
      console.error('[API /patients] Insert error:', {
        code: error.code,
        message: error.message,
        details: error.details
      })
      
      return NextResponse.json(
        { error: `환자 등록 실패: ${error.message}` },
        { status: 500 }
      )
    }
    
    console.log('[API /patients] Patient created successfully:', data.id)
    
    // Return the created patient in camelCase format
    return NextResponse.json(toCamelCase(data))
    
  } catch (error) {
    console.error('[API /patients] Unexpected error:', error)
    
    // Handle Zod validation errors explicitly
    if (error instanceof ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      
      return NextResponse.json(
        { 
          error: '입력 데이터가 올바르지 않습니다.',
          details: errors
        },
        { status: 400 }
      )
    }
    
    // Handle all other errors as 500
    return NextResponse.json(
      { error: '환자 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}