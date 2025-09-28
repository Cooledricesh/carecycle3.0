'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AuditLog } from '@/types/activity'
import { activityService } from '@/services/activityService'

interface ActivityItemProps {
  log: AuditLog
}

export function ActivityItem({ log }: ActivityItemProps) {
  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return '생성'
      case 'UPDATE':
        return '수정'
      case 'DELETE':
        return '삭제'
      default:
        return operation
    }
  }

  const getTableLabel = (tableName: string) => {
    switch (tableName) {
      case 'patients':
        return '환자'
      case 'schedules':
        return '스케줄'
      case 'profiles':
        return '사용자'
      case 'schedule_executions':
        return '스케줄 실행'
      default:
        return tableName
    }
  }

  const description = activityService.generateDescription(log)

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getOperationColor(log.operation)}>
              {getOperationLabel(log.operation)}
            </Badge>
            <Badge variant="outline">{getTableLabel(log.tableName)}</Badge>
            {log.userRole && (
              <Badge variant="secondary">{log.userRole}</Badge>
            )}
          </div>
          <p className="text-sm font-medium mb-1">{description}</p>
          <p className="text-xs text-muted-foreground">
            {log.userName || log.userEmail || '알 수 없음'}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground whitespace-nowrap ml-4">
          <div>
            {format(new Date(log.timestamp), 'yyyy-MM-dd', { locale: ko })}
          </div>
          <div>{format(new Date(log.timestamp), 'HH:mm:ss', { locale: ko })}</div>
        </div>
      </div>
    </Card>
  )
}