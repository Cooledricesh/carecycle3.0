'use client'

import { EventEmitter } from 'events'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type DatabaseEvent = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  payload: RealtimePostgresChangesPayload<any>
  timestamp: number
}

export type ConnectionEvent = {
  type: 'connected' | 'disconnected' | 'reconnecting' | 'error'
  message?: string
  timestamp: number
}

export class RealtimeEventManager extends EventEmitter {
  private static instance: RealtimeEventManager
  private channels: Map<string, RealtimeChannel> = new Map()
  private connectionState: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected'
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  private constructor() {
    super()
    this.setMaxListeners(100) // Increase listener limit for multiple components
  }

  public static getInstance(): RealtimeEventManager {
    if (!RealtimeEventManager.instance) {
      RealtimeEventManager.instance = new RealtimeEventManager()
    }
    return RealtimeEventManager.instance
  }

  // Subscribe to database events
  public subscribeToTable(
    table: string,
    callback: (event: DatabaseEvent) => void
  ): () => void {
    const eventName = `db:${table}`
    this.on(eventName, callback)
    
    // Return unsubscribe function
    return () => {
      this.off(eventName, callback)
    }
  }

  // Subscribe to connection events
  public subscribeToConnection(
    callback: (event: ConnectionEvent) => void
  ): () => void {
    this.on('connection', callback)
    
    return () => {
      this.off('connection', callback)
    }
  }

  // Emit database event to all listeners
  public emitDatabaseEvent(event: DatabaseEvent) {
    // Emit to specific table listeners
    this.emit(`db:${event.table}`, event)
    
    // Emit to global database listeners
    this.emit('database', event)
  }

  // Emit connection event
  public emitConnectionEvent(event: ConnectionEvent) {
    this.connectionState = event.type === 'connected' ? 'connected' : 
                           event.type === 'reconnecting' ? 'reconnecting' : 
                           'disconnected'
    
    this.emit('connection', event)
  }

  // Register a channel for tracking
  public registerChannel(name: string, channel: RealtimeChannel) {
    this.channels.set(name, channel)
  }

  // Unregister a channel
  public unregisterChannel(name: string) {
    const channel = this.channels.get(name)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(name)
    }
  }

  // Get current connection state
  public getConnectionState() {
    return this.connectionState
  }

  // Handle reconnection logic
  public scheduleReconnect(callback: () => Promise<void>) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitConnectionEvent({
        type: 'error',
        message: 'Maximum reconnection attempts exceeded',
        timestamp: Date.now()
      })
      return
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000)
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++
      this.emitConnectionEvent({
        type: 'reconnecting',
        message: `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
        timestamp: Date.now()
      })
      
      try {
        await callback()
        this.reconnectAttempts = 0
        this.emitConnectionEvent({
          type: 'connected',
          message: 'Successfully reconnected',
          timestamp: Date.now()
        })
      } catch (error) {
        this.scheduleReconnect(callback)
      }
    }, delay)
  }

  // Reset reconnection attempts
  public resetReconnection() {
    this.reconnectAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // Cleanup all channels and listeners
  public cleanup() {
    this.channels.forEach(channel => channel.unsubscribe())
    this.channels.clear()
    this.removeAllListeners()
    this.resetReconnection()
  }
}

// Export singleton instance
export const eventManager = RealtimeEventManager.getInstance()