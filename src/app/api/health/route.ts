import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiResponseBuilder } from '@/lib/api/response'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    database: {
      status: 'up' | 'down'
      responseTime?: number
      error?: string
    }
    auth: {
      status: 'up' | 'down'
      error?: string
    }
    realtime?: {
      status: 'connected' | 'disconnected' | 'reconnecting'
      activeChannels?: number
    }
  }
  environment: string
  version: string
}

const startTime = Date.now()

export async function GET(request: NextRequest) {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    checks: {
      database: { status: 'down' },
      auth: { status: 'down' },
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  }
  
  try {
    // Check database connection
    const dbStart = Date.now()
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
      .single()
    
    if (dbError) {
      healthStatus.checks.database = {
        status: 'down',
        error: dbError.message,
      }
      healthStatus.status = 'unhealthy'
    } else {
      healthStatus.checks.database = {
        status: 'up',
        responseTime: Date.now() - dbStart,
      }
    }
    
    // Check auth service
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) {
      healthStatus.checks.auth = {
        status: 'down',
        error: authError.message,
      }
      healthStatus.status = healthStatus.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    } else {
      healthStatus.checks.auth = { status: 'up' }
    }
    
    // Return appropriate status code based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                       healthStatus.status === 'degraded' ? 200 : 503
    
    return ApiResponseBuilder.success(healthStatus, 'Health check completed')
  } catch (error) {
    healthStatus.status = 'unhealthy'
    healthStatus.checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    
    return ApiResponseBuilder.success(healthStatus, 'Health check completed with errors')
  }
}