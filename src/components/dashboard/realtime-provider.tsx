'use client'

import { ReactNode } from 'react'
import { useGlobalRealtimeSync } from '@/hooks/useRealtimeSync'
import { useSmartSync } from '@/hooks/useFallbackSync'

interface RealtimeProviderProps {
  children: ReactNode
}

/**
 * Client component wrapper that enables real-time synchronization
 * Should wrap all authenticated pages to ensure data stays in sync
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  // Enable real-time sync for all child components
  useGlobalRealtimeSync()
  
  // Enable smart sync with automatic fallback to polling
  useSmartSync()
  
  return <>{children}</>
}