import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { doctorId } = await request.json()

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

    // Only admins can change doctor assignments
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: '주치의 변경 권한이 없습니다. 관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // Use service client to bypass RLS for the update
    const serviceClient = await createServiceClient()

    // Update the patient's doctor_id
    const { data, error } = await serviceClient
      .from('patients')
      .update({
        doctor_id: doctorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating patient doctor:', error)
      return NextResponse.json(
        { error: `주치의 변경 실패: ${error.message}` },
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