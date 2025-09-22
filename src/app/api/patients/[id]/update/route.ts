import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await request.json()

    // First verify the user is authenticated and has permission
    const userClient = await createClient()
    const { data: { user }, error: authError } = await userClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    // Check user role
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '사용자 정보를 확인할 수 없습니다' },
        { status: 403 }
      )
    }

    // Only nurses and admins can update patient information
    // Doctors can only update certain fields for their assigned patients
    const allowedRoles = ['nurse', 'admin', 'doctor']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: '환자 정보 수정 권한이 없습니다' },
        { status: 403 }
      )
    }

    // If user is a doctor, verify they're assigned to this patient
    // and restrict what they can update
    if (profile.role === 'doctor') {
      const { data: patient, error: patientError } = await userClient
        .from('patients')
        .select('doctor_id')
        .eq('id', id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json(
          { error: '환자를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // Check if doctor is assigned to this patient
      if (patient.doctor_id !== user.id) {
        return NextResponse.json(
          { error: '담당 환자만 수정할 수 있습니다' },
          { status: 403 }
        )
      }

      // Restrict fields that doctors can update
      const restrictedFields = ['doctor_id', 'care_type', 'department', 'hospital_id']
      const hasRestrictedField = restrictedFields.some(field => field in updates)

      if (hasRestrictedField) {
        return NextResponse.json(
          { error: '의사는 해당 필드를 수정할 수 없습니다' },
          { status: 403 }
        )
      }
    }

    // Use service client to bypass RLS for the update
    const serviceClient = await createServiceClient()

    // Prepare the update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Map camelCase to snake_case for database columns
    if ('doctorId' in updates) updateData.doctor_id = updates.doctorId
    if ('careType' in updates) updateData.care_type = updates.careType
    if ('department' in updates) updateData.department = updates.department
    if ('name' in updates) updateData.name = updates.name
    if ('patientNumber' in updates) updateData.patient_number = updates.patientNumber
    if ('isActive' in updates) updateData.is_active = updates.isActive
    if ('metadata' in updates) updateData.metadata = updates.metadata

    // Update the patient
    const { data, error } = await serviceClient
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating patient:', error)
      return NextResponse.json(
        { error: `환자 정보 수정 실패: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}