'use client'

import { eventManager } from '@/lib/realtime/event-manager'

type PerformanceMetric = {
  timestamp: number
  type: 'query' | 'mutation' | 'realtime' | 'connection'
  name: string
  duration?: number
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

type ConnectionHealth = {
  status: 'connected' | 'disconnected' | 'reconnecting'
  lastConnected?: number
  lastDisconnected?: number
  reconnectAttempts: number
  uptime: number
  downtime: number
}

type QueryStats = {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  averageTime: number
  slowestQuery: { name: string; duration: number } | null
  cacheHitRate: number
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics
  private connectionHealth: ConnectionHealth = {
    status: 'disconnected',
    reconnectAttempts: 0,
    uptime: 0,
    downtime: 0
  }
  private sessionStartTime = Date.now()
  private lastConnectionCheckTime = Date.now()

  private constructor() {
    // Subscribe to connection events
    eventManager.subscribeToConnection((event) => {
      this.updateConnectionHealth(event)
    })
    
    // Periodic health check
    if (typeof window !== 'undefined') {
      setInterval(() => this.calculateHealthMetrics(), 30000) // Every 30 seconds
    }
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Record a performance metric
  public recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log slow queries
    if (metric.type === 'query' && metric.duration && metric.duration > 1000) {
      console.warn(`[PerformanceMonitor] Slow query detected: ${metric.name} took ${metric.duration}ms`)
    }

    // Log errors
    if (!metric.success && metric.error) {
      console.error(`[PerformanceMonitor] Error in ${metric.type} "${metric.name}":`, metric.error)
    }
  }

  // Update connection health based on events
  private updateConnectionHealth(event: { type: string; timestamp: number }) {
    const now = Date.now()
    const timeSinceLastCheck = now - this.lastConnectionCheckTime

    switch (event.type) {
      case 'connected':
        if (this.connectionHealth.status !== 'connected') {
          this.connectionHealth.lastConnected = now
          this.connectionHealth.downtime += timeSinceLastCheck
        }
        this.connectionHealth.status = 'connected'
        this.connectionHealth.reconnectAttempts = 0
        break

      case 'disconnected':
        if (this.connectionHealth.status === 'connected') {
          this.connectionHealth.lastDisconnected = now
          this.connectionHealth.uptime += timeSinceLastCheck
        }
        this.connectionHealth.status = 'disconnected'
        break

      case 'reconnecting':
        this.connectionHealth.status = 'reconnecting'
        this.connectionHealth.reconnectAttempts++
        break
    }

    this.lastConnectionCheckTime = now
  }

  // Calculate health metrics
  private calculateHealthMetrics() {
    const now = Date.now()
    const timeSinceLastCheck = now - this.lastConnectionCheckTime

    // Update uptime/downtime
    if (this.connectionHealth.status === 'connected') {
      this.connectionHealth.uptime += timeSinceLastCheck
    } else {
      this.connectionHealth.downtime += timeSinceLastCheck
    }

    this.lastConnectionCheckTime = now
  }

  // Get query statistics
  public getQueryStats(): QueryStats {
    const queryMetrics = this.metrics.filter(m => m.type === 'query')
    const successfulQueries = queryMetrics.filter(m => m.success)
    
    const totalDuration = successfulQueries.reduce((sum, m) => sum + (m.duration || 0), 0)
    const averageTime = successfulQueries.length > 0 ? totalDuration / successfulQueries.length : 0

    const slowestQuery = successfulQueries
      .filter(m => m.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))[0]

    // Calculate cache hit rate (queries that took < 10ms are likely cache hits)
    const cacheHits = successfulQueries.filter(m => m.duration && m.duration < 10).length
    const cacheHitRate = successfulQueries.length > 0 ? (cacheHits / successfulQueries.length) * 100 : 0

    return {
      totalQueries: queryMetrics.length,
      successfulQueries: successfulQueries.length,
      failedQueries: queryMetrics.length - successfulQueries.length,
      averageTime: Math.round(averageTime),
      slowestQuery: slowestQuery ? {
        name: slowestQuery.name,
        duration: slowestQuery.duration || 0
      } : null,
      cacheHitRate: Math.round(cacheHitRate)
    }
  }

  // Get connection health
  public getConnectionHealth(): ConnectionHealth & { uptimePercentage: number } {
    const totalTime = this.connectionHealth.uptime + this.connectionHealth.downtime
    const uptimePercentage = totalTime > 0 ? (this.connectionHealth.uptime / totalTime) * 100 : 0

    return {
      ...this.connectionHealth,
      uptimePercentage: Math.round(uptimePercentage)
    }
  }

  // Get recent errors
  public getRecentErrors(limit = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
  }

  // Get performance summary
  public getPerformanceSummary() {
    const sessionDuration = Date.now() - this.sessionStartTime
    const queryStats = this.getQueryStats()
    const connectionHealth = this.getConnectionHealth()
    const recentErrors = this.getRecentErrors(5)

    return {
      sessionDuration: Math.round(sessionDuration / 1000), // in seconds
      queryStats,
      connectionHealth,
      recentErrors,
      totalMetrics: this.metrics.length,
      recommendation: this.getRecommendation(queryStats, connectionHealth)
    }
  }

  // Get performance recommendation
  private getRecommendation(queryStats: QueryStats, connectionHealth: any): string {
    const recommendations = []

    // Check connection health
    if (connectionHealth.uptimePercentage < 90) {
      recommendations.push('실시간 연결이 불안정합니다. 네트워크 상태를 확인하세요.')
    }

    // Check query performance
    if (queryStats.averageTime > 500) {
      recommendations.push('쿼리 성능이 느립니다. 캐싱 전략을 검토하세요.')
    }

    // Check cache hit rate
    if (queryStats.cacheHitRate < 50 && queryStats.totalQueries > 10) {
      recommendations.push('캐시 적중률이 낮습니다. React Query 설정을 최적화하세요.')
    }

    // Check error rate
    const errorRate = queryStats.totalQueries > 0 
      ? (queryStats.failedQueries / queryStats.totalQueries) * 100 
      : 0
    if (errorRate > 5) {
      recommendations.push('오류율이 높습니다. 에러 처리 로직을 검토하세요.')
    }

    return recommendations.length > 0 
      ? recommendations.join(' ') 
      : '시스템이 정상적으로 작동 중입니다.'
  }

  // Clear metrics
  public clearMetrics() {
    this.metrics = []
  }

  // Export metrics for debugging
  public exportMetrics() {
    return {
      metrics: this.metrics,
      summary: this.getPerformanceSummary()
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Helper function to measure query performance
export function measureQueryPerformance<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  
  return queryFn()
    .then((result) => {
      performanceMonitor.recordMetric({
        type: 'query',
        name,
        duration: Date.now() - startTime,
        success: true
      })
      return result
    })
    .catch((error) => {
      performanceMonitor.recordMetric({
        type: 'query',
        name,
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      })
      throw error
    })
}