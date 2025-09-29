'use client'

import { Edit, Trash2, MoreVertical, Clock, Bell } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, touchTarget } from '@/lib/utils'
import type { Item } from '@/lib/database.types'

interface ItemCardProps {
  item: Item
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string, status: boolean) => void
  isToggling?: boolean
}

export function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
  isToggling = false
}: ItemCardProps) {
  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      injection: {
        label: '주사',
        className: 'bg-blue-100 text-blue-700 border-blue-200'
      },
      test: {
        label: '검사',
        className: 'bg-green-100 text-green-700 border-green-200'
      },
      other: {
        label: '기타',
        className: 'bg-gray-100 text-gray-700 border-gray-200'
      },
    }

    const config = categoryConfig[category as keyof typeof categoryConfig] || {
      label: category,
      className: 'bg-gray-100 text-gray-700'
    }

    return (
      <Badge className={cn('border', config.className)}>
        {config.label}
      </Badge>
    )
  }

  return (
    <Card className={cn(
      'p-4 hover:shadow-md transition-all duration-200',
      !item.is_active && 'opacity-60 bg-gray-50'
    )}>
      <div className="space-y-3">
        {/* Header: 카테고리, 코드, 상태 토글 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            {getCategoryBadge(item.category)}
            <span className="font-mono text-xs text-gray-500">
              {item.code}
            </span>
          </div>

          {/* 상태 토글 스위치 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {item.is_active ? '활성' : '비활성'}
            </span>
            <Switch
              checked={item.is_active ?? true}
              onCheckedChange={(checked) => onToggleStatus(item.id, checked)}
              disabled={isToggling}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
        </div>

        {/* Body: 항목명과 설명 */}
        <div>
          <h4 className="font-medium text-base text-gray-900">
            {item.name}
          </h4>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Info: 주기, 알림 */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {item.default_interval_weeks && (
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="h-3.5 w-3.5" />
              <span>{item.default_interval_weeks}주 주기</span>
            </div>
          )}

          {item.requires_notification && (
            <div className="flex items-center gap-1 text-gray-600">
              <Bell className="h-3.5 w-3.5" />
              <span>{item.notification_days_before}일 전 알림</span>
            </div>
          )}

          {!item.default_interval_weeks && !item.requires_notification && (
            <span className="text-gray-400 text-xs">설정된 주기/알림 없음</span>
          )}
        </div>

        {/* Actions: 수정, 삭제 버튼 */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="default"
            className={cn('flex-1', touchTarget.button)}
            onClick={() => onEdit(item)}
          >
            <Edit className="h-4 w-4 mr-1.5" />
            수정
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn(touchTarget.button)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onDelete(item.id)}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Instructions/Notes (collapsible in future) */}
        {(item.instructions || item.preparation_notes) && (
          <div className="pt-3 border-t space-y-2">
            {item.instructions && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">지시사항: </span>
                <span className="text-gray-600">{item.instructions}</span>
              </div>
            )}
            {item.preparation_notes && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">준비사항: </span>
                <span className="text-gray-600">{item.preparation_notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}