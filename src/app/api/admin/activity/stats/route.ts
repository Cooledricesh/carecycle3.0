import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { activityService } from '@/services/activityService'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'
export const revalidate = 0

// Validate environment variables at module level
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[API /admin/activity/stats] Missing required environment variable: ${envVar}`)
  }
}

export async function GET() {
  try {
    // Wrap client creation with explicit error handling
    let supabase
    try {
      supabase = await createClient()
    } catch (error) {
      console.error('[API /admin/activity/stats] Failed to create Supabase client:', error)
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await (supabase as any).auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status, is_active')
      .eq('id', user.id)
      .single<{ role: string; approval_status: string; is_active: boolean }>()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      )
    }

    if (profile.approval_status !== 'approved' || !profile.is_active) {
      return NextResponse.json(
        { error: '승인된 활성 사용자만 접근할 수 있습니다.' },
        { status: 403 }
      )
    }

    const stats = await activityService.getStats(supabase)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[API /admin/activity/stats] Error:', error)

    return NextResponse.json(
      {
        error: '통계 데이터 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 200 })
}