'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronLeft, ChevronRight, Activity as ActivityIcon } from 'lucide-react'
import { ActivityItem } from './activity-item'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import type { ActivityFilters } from '@/types/activity'

interface ActivityFeedProps {
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
}

export function ActivityFeed({ filters, onFiltersChange }: ActivityFeedProps) {
  const { data, isLoading, error } = useAuditLogs(filters)

  const handlePageChange = (newPage: number) => {
    onFiltersChange({ ...filters, page: newPage })
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5" />
            활동 로그
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              활동 로그를 불러오는 중 오류가 발생했습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5" />
          활동 로그
        </CardTitle>
        <CardDescription>
          시스템 내 모든 활동 기록을 확인할 수 있습니다.
          {data && ` (전체 ${data.total}개)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : data && data.logs.length > 0 ? (
          <>
            <div className="space-y-3 mb-4">
              {data.logs.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  페이지 {data.page} / {data.totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page === data.totalPages}
                  >
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">활동 로그가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}