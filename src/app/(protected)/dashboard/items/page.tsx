'use client'

import { ItemsManager } from '@/components/dashboard/items-manager'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn, responsivePadding, responsiveText } from '@/lib/utils'

export default function ItemsPage() {
  const isMobile = useIsMobile()

  return (
    <div className={cn(
      "container mx-auto",
      responsivePadding.page,
      "py-4 sm:py-6"
    )}>
      <div className={cn(
        "mb-4 sm:mb-6",
        isMobile && "space-y-2"
      )}>
        <h1 className={cn(
          responsiveText.h1,
          "text-gray-900"
        )}>
          검사/주사 항목 관리
        </h1>
        <p className={cn(
          "text-gray-600",
          isMobile ? "text-sm" : "text-base mt-2"
        )}>
          시스템에서 사용할 검사 및 주사 항목을 관리합니다.
        </p>
      </div>
      <ItemsManager />
    </div>
  )
}