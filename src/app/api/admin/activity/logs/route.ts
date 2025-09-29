import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { activityService } from '@/services/activityService'
import type { ActivityFilters } from '@/types/activity'

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
    console.error(`[API /admin/activity/logs] Missing required environment variable: ${envVar}`)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Wrap client creation with explicit error handling
    let supabase
    try {
      supabase = await createClient()
    } catch (error) {
      console.error('[API /admin/activity/logs] Failed to create Supabase client:', error)
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status, is_active')
      .eq('id', user.id)
      .single()

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

    const searchParams = request.nextUrl.searchParams
    const filters: ActivityFilters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userId: searchParams.get('userId') || undefined,
      tableName: (searchParams.get('tableName') as any) || undefined,
      operation: (searchParams.get('operation') as any) || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    const result = await activityService.getAuditLogs(filters, supabase)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API /admin/activity/logs] Error:', error)

    return NextResponse.json(
      {
        error: '활동 로그 조회 중 오류가 발생했습니다.',
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