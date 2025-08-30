'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

export default function DebugPage() {
  const [performanceData, setPerformanceData] = useState(performanceMonitor.getPerformanceSummary())
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const isConnected = false // Removed real-time connection

  useEffect(() => {
    // Auto-refresh every 2 seconds
    const interval = setInterval(() => {
      setPerformanceData(performanceMonitor.getPerformanceSummary())
    }, 2000)
    
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  const handleManualRefresh = () => {
    setPerformanceData(performanceMonitor.getPerformanceSummary())
  }

  const handleClearMetrics = () => {
    performanceMonitor.clearMetrics()
    setPerformanceData(performanceMonitor.getPerformanceSummary())
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성능 모니터링</h1>
          <p className="text-gray-600">실시간 시스템 상태 및 성능 지표</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleManualRefresh} 
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
          <Button 
            onClick={handleClearMetrics} 
            variant="outline"
            size="sm"
            className="text-destructive"
          >
            메트릭 초기화
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>실시간 연결 상태</CardTitle>
            <CardDescription>WebSocket 연결 및 안정성</CardDescription>
          </div>
          {isConnected ? (
            <Badge className="bg-green-100 text-green-800">
              <Wifi className="h-4 w-4 mr-1" />
              연결됨
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800">
              <WifiOff className="h-4 w-4 mr-1" />
              연결 끊김
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">가동 시간</p>
              <p className="text-2xl font-bold text-green-600">
                {performanceData.connectionHealth.uptimePercentage}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">재연결 시도</p>
              <p className="text-2xl font-bold">
                {performanceData.connectionHealth.reconnectAttempts}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">마지막 연결</p>
              <p className="text-sm font-medium">
                {performanceData.connectionHealth.lastConnected 
                  ? new Date(performanceData.connectionHealth.lastConnected).toLocaleTimeString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">세션 시간</p>
              <p className="text-sm font-medium">
                {formatDuration(performanceData.sessionDuration)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Query Performance */}
      <Card>
        <CardHeader>
          <CardTitle>쿼리 성능</CardTitle>
          <CardDescription>데이터베이스 쿼리 및 캐시 성능</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">전체 쿼리</p>
              <p className="text-2xl font-bold">
                {performanceData.queryStats.totalQueries}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">평균 응답 시간</p>
              <p className="text-2xl font-bold">
                {performanceData.queryStats.averageTime}ms
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">캐시 적중률</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {performanceData.queryStats.cacheHitRate}%
                </p>
                {performanceData.queryStats.cacheHitRate > 70 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">실패한 쿼리</p>
              <p className="text-2xl font-bold text-red-600">
                {performanceData.queryStats.failedQueries}
              </p>
            </div>
          </div>

          {performanceData.queryStats.slowestQuery && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>가장 느린 쿼리</AlertTitle>
              <AlertDescription>
                {performanceData.queryStats.slowestQuery.name} - {performanceData.queryStats.slowestQuery.duration}ms
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {performanceData.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              최근 오류
            </CardTitle>
            <CardDescription>마지막 5개의 오류</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceData.recentErrors.map((error, index) => (
                <div key={index} className="p-3 border rounded-lg bg-red-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{error.name}</p>
                      <p className="text-sm text-red-600">{error.error}</p>
                    </div>
                    <Badge variant="destructive">{error.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(error.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>권장 사항</CardTitle>
          <CardDescription>성능 개선을 위한 제안</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertTitle>시스템 분석</AlertTitle>
            <AlertDescription>
              {performanceData.recommendation}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>시스템 정보</CardTitle>
          <CardDescription>환경 및 구성</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">총 메트릭 수</span>
              <span className="text-sm font-medium">{performanceData.totalMetrics}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">브라우저</span>
              <span className="text-sm font-medium">
                {typeof window !== 'undefined' ? navigator.userAgent.split(' ').slice(-2).join(' ') : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">메모리 사용량</span>
              <span className="text-sm font-medium">
                {typeof window !== 'undefined' && 'memory' in performance
                  ? formatBytes((performance as any).memory.usedJSHeapSize)
                  : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}