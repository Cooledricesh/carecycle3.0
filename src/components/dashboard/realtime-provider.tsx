'use client'

import { ReactNode } from 'react'
import { useGlobalRealtimeSync } from '@/hooks/useRealtimeSync'

interface RealtimeProviderProps {
  children: ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  useGlobalRealtimeSync()
  
  return <>{children}</>
}