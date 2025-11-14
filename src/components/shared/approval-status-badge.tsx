'use client'

import { Badge } from '@/components/ui/badge'
import { Clock, Check, X } from 'lucide-react'

interface ApprovalStatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
}

export function ApprovalStatusBadge({ status, size = 'md' }: ApprovalStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'

  switch (status) {
    case 'pending':
      return (
        <Badge className={`bg-yellow-100 text-yellow-800 ${textSize}`}>
          <Clock className={`${iconSize} mr-1`} />
          승인 대기
        </Badge>
      )
    case 'approved':
      return (
        <Badge className={`bg-green-100 text-green-800 ${textSize}`}>
          <Check className={`${iconSize} mr-1`} />
          승인됨
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className={`bg-red-100 text-red-800 ${textSize}`}>
          <X className={`${iconSize} mr-1`} />
          거부됨
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
