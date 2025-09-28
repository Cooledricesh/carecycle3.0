'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Activity, Settings, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActivityStats } from '@/types/activity'

interface ActivityStatsCardsProps {
  stats: ActivityStats | undefined
  isLoading: boolean
}

export function ActivityStatsCards({ stats, isLoading }: ActivityStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      title: '전체 사용자',
      value: stats.totalUsers,
      description: `활성: ${stats.activeUsers}명`,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: '오늘의 활동',
      value: stats.todayActivities,
      description: '오늘 발생한 활동 수',
      icon: Activity,
      color: 'text-green-600',
    },
    {
      title: '시스템 상태',
      value: stats.systemStatus === 'healthy' ? '정상' : '오류',
      description: '모든 서비스 운영 중',
      icon: Settings,
      color: stats.systemStatus === 'healthy' ? 'text-green-600' : 'text-red-600',
    },
    {
      title: '중요 알림',
      value: stats.criticalAlerts,
      description: '오늘 삭제 작업 수',
      icon: AlertTriangle,
      color: stats.criticalAlerts > 0 ? 'text-red-600' : 'text-gray-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}