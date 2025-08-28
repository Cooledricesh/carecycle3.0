'use server'

import { NextRequest } from 'next/server'
import { apiErrors } from './response'

// Simple in-memory rate limiter for development
// In production, use Redis or Upstash
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
  keyGenerator?: (req: NextRequest) => string  // Function to generate rate limit key
  skipSuccessfulRequests?: boolean  // Don't count successful requests
  skipFailedRequests?: boolean  // Don't count failed requests
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
}

export function getRateLimitKey(req: NextRequest, customKey?: string): string {
  if (customKey) return customKey
  
  // Try to get user ID from various sources
  const userId = req.headers.get('x-user-id')
  if (userId) return `user:${userId}`
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return `ip:${ip}`
}

export async function checkRateLimit(
  req: NextRequest,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const finalConfig = { ...defaultConfig, ...config }
  const key = finalConfig.keyGenerator ? finalConfig.keyGenerator(req) : getRateLimitKey(req)
  
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }
  
  if (!entry || entry.resetTime <= now) {
    // Create new entry
    const resetTime = now + finalConfig.windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return {
      allowed: true,
      remaining: finalConfig.maxRequests - 1,
      resetTime,
    }
  }
  
  // Check if limit exceeded
  if (entry.count >= finalConfig.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }
  
  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    allowed: true,
    remaining: finalConfig.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key)
    }
  }
}

export async function rateLimitMiddleware(
  req: NextRequest,
  config?: Partial<RateLimitConfig>
) {
  const result = await checkRateLimit(req, config)
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
    return apiErrors.rateLimit(`Rate limit exceeded. Retry after ${retryAfter} seconds`)
  }
  
  return null // Continue processing
}

// Preset configurations for different endpoints
export const rateLimitPresets = {
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  relaxed: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
} as const