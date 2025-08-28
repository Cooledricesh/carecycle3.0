'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { eventManager } from './event-manager'

export class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager
  private supabase: SupabaseClient<Database> | null = null
  private isInitialized = false

  private constructor() {}

  public static getInstance(): RealtimeConnectionManager {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager()
    }
    return RealtimeConnectionManager.instance
  }

  // Initialize with Supabase client
  public async initialize(supabase: SupabaseClient<Database>) {
    if (this.isInitialized) {
      console.log('[RealtimeConnectionManager] Already initialized')
      return
    }

    this.supabase = supabase
    this.isInitialized = true

    // Set up the main realtime channel
    await this.setupRealtimeSubscriptions()
  }

  private async setupRealtimeSubscriptions() {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized')
    }

    console.log('[RealtimeConnectionManager] Setting up realtime subscriptions')

    // Create a single channel for all database changes
    const channel = this.supabase
      .channel('database-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients'
        },
        (payload) => {
          console.log('[Realtime] Patients change:', payload)
          eventManager.emitDatabaseEvent({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'patients',
            payload,
            timestamp: Date.now()
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules'
        },
        (payload) => {
          console.log('[Realtime] Schedules change:', payload)
          eventManager.emitDatabaseEvent({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'schedules',
            payload,
            timestamp: Date.now()
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_executions'
        },
        (payload) => {
          console.log('[Realtime] Schedule executions change:', payload)
          eventManager.emitDatabaseEvent({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'schedule_executions',
            payload,
            timestamp: Date.now()
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          console.log('[Realtime] Items change:', payload)
          eventManager.emitDatabaseEvent({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'items',
            payload,
            timestamp: Date.now()
          })
        }
      )

    // Subscribe and handle connection states
    channel.subscribe((status) => {
      console.log('[RealtimeConnectionManager] Channel status:', status)
      
      if (status === 'SUBSCRIBED') {
        eventManager.emitConnectionEvent({
          type: 'connected',
          message: 'Realtime channel subscribed',
          timestamp: Date.now()
        })
        eventManager.resetReconnection()
      } else if (status === 'CHANNEL_ERROR') {
        eventManager.emitConnectionEvent({
          type: 'error',
          message: 'Channel error occurred',
          timestamp: Date.now()
        })
        // Schedule reconnection
        eventManager.scheduleReconnect(async () => {
          await this.reconnect()
        })
      } else if (status === 'TIMED_OUT') {
        eventManager.emitConnectionEvent({
          type: 'disconnected',
          message: 'Channel timed out',
          timestamp: Date.now()
        })
        // Schedule reconnection
        eventManager.scheduleReconnect(async () => {
          await this.reconnect()
        })
      }
    })

    // Register the channel with event manager
    eventManager.registerChannel('database-changes', channel)
  }

  // Reconnect to realtime
  private async reconnect() {
    if (!this.supabase) {
      throw new Error('Cannot reconnect: Supabase client not initialized')
    }

    console.log('[RealtimeConnectionManager] Attempting to reconnect...')
    
    // Unregister old channel
    eventManager.unregisterChannel('database-changes')
    
    // Set up new subscriptions
    await this.setupRealtimeSubscriptions()
  }

  // Manual disconnect
  public disconnect() {
    console.log('[RealtimeConnectionManager] Disconnecting...')
    eventManager.unregisterChannel('database-changes')
    eventManager.cleanup()
    this.isInitialized = false
    this.supabase = null
  }

  // Get connection status
  public isConnected(): boolean {
    return eventManager.getConnectionState() === 'connected'
  }
}

// Export singleton instance
export const connectionManager = RealtimeConnectionManager.getInstance()