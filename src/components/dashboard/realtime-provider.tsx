'use client'

import { ReactNode } from 'react'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'

interface RealtimeProviderProps {
  children: ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { isConnected } = useRealtimeEvents()
  
  return (
    <>
      {children}
      {/* Connection status indicator */}
      {!isConnected && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-3 py-1 rounded-md text-sm shadow-lg z-50 flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          실시간 연결 중...
        </div>
      )}
    </>
  )
}