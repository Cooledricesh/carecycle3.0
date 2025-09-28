'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActivityFilters } from '@/types/activity'

interface ActivityDateFilterProps {
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
}

export function ActivityDateFilter({ filters, onFiltersChange }: ActivityDateFilterProps) {
  const [startDate, setStartDate] = useState(filters.startDate || '')
  const [endDate, setEndDate] = useState(filters.endDate || '')

  const handleApply = () => {
    onFiltersChange({
      ...filters,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
    })
  }

  const handleReset = () => {
    setStartDate('')
    setEndDate('')
    onFiltersChange({
      ...filters,
      startDate: undefined,
      endDate: undefined,
      page: 1,
    })
  }

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  const setLast7Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 7)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const setLast30Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4" />
          기간 필터
        </CardTitle>
        <CardDescription>활동 로그를 날짜로 필터링합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">시작일</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">종료일</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={setToday}>
            오늘
          </Button>
          <Button variant="outline" size="sm" onClick={setLast7Days}>
            최근 7일
          </Button>
          <Button variant="outline" size="sm" onClick={setLast30Days}>
            최근 30일
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleApply} className="flex-1">
            적용
          </Button>
          <Button variant="outline" onClick={handleReset}>
            초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}