'use client'

import { ItemsManager } from '@/components/dashboard/items-manager'

export default function ItemsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">검사/주사 항목 관리</h1>
        <p className="text-gray-600 mt-2">
          시스템에서 사용할 검사 및 주사 항목을 관리합니다.
        </p>
      </div>
      <ItemsManager />
    </div>
  )
}