'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ActivityStatsCards } from '@/components/admin/activity-stats-cards'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { useActivityStats } from '@/hooks/useActivityStats'
import type { ActivityFilters } from '@/types/activity'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const { data: stats, isLoading } = useActivityStats()
  const [filters, setFilters] = useState<ActivityFilters>({
    page: 1,
    limit: 20,
  })

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await (supabase as any).auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<{ role: string }>()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
      }
    }

    checkAuth()
  }, [router, supabase])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground">
          시스템 활동 로그 및 통계를 확인하세요
        </p>
      </div>

      <ActivityStatsCards stats={stats} isLoading={isLoading} />

      <div>
        <h2 className="text-2xl font-semibold mb-4">활동 로그</h2>
        <ActivityFeed filters={filters} onFiltersChange={setFilters} />
      </div>
    </div>
  )
}