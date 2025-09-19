'use client'

import { Edit, Trash2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Item } from '@/lib/database.types'

interface ItemTableProps {
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string, status: boolean) => void
  isToggling?: boolean
}

export function ItemTable({
  items,
  onEdit,
  onDelete,
  onToggleStatus,
  isToggling = false
}: ItemTableProps) {
  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      injection: {
        label: '주사',
        className: 'bg-blue-100 text-blue-700'
      },
      test: {
        label: '검사',
        className: 'bg-green-100 text-green-700'
      },
      treatment: {
        label: '처치',
        className: 'bg-yellow-100 text-yellow-700'
      },
      medication: {
        label: '약물',
        className: 'bg-purple-100 text-purple-700'
      },
      other: {
        label: '기타',
        className: 'bg-gray-100 text-gray-700'
      },
    }

    const config = categoryConfig[category as keyof typeof categoryConfig] || {
      label: category,
      className: 'bg-gray-100 text-gray-700'
    }

    return <Badge className={config.className}>{config.label}</Badge>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        항목이 없습니다.
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">코드</TableHead>
            <TableHead>항목명</TableHead>
            <TableHead className="w-28">카테고리</TableHead>
            <TableHead className="w-24">기본 주기</TableHead>
            <TableHead className="w-28">알림</TableHead>
            <TableHead className="w-20">상태</TableHead>
            <TableHead className="text-right w-20">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(
                "hover:bg-gray-50",
                !item.is_active && "opacity-60 bg-gray-50/50"
              )}
            >
              <TableCell className="font-mono text-sm">
                {item.code}
              </TableCell>

              <TableCell>
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {item.description}
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell>
                {getCategoryBadge(item.category)}
              </TableCell>

              <TableCell>
                {item.default_interval_weeks ? (
                  <span className="text-sm">{item.default_interval_weeks}주</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>

              <TableCell>
                {item.requires_notification ? (
                  <Badge variant="outline" className="text-green-600">
                    {item.notification_days_before}일 전
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">
                    없음
                  </Badge>
                )}
              </TableCell>

              <TableCell>
                <Switch
                  checked={item.is_active ?? true}
                  onCheckedChange={(checked) => onToggleStatus(item.id, checked)}
                  disabled={isToggling}
                />
              </TableCell>

              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Edit className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(item.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}