'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { eventManager } from './event-manager'

export class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager
  private supabase: SupabaseClient<Database> | null = null
  private isInitialized = false
  private currentChannel: any = null
  private isReconnecting = false

  private constructor() {}

  public static getInstance(): RealtimeConnectionManager {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager()
    }
    return RealtimeConnectionManager.instance
  }

  // Initialize with Supabase client
  public async initialize(supabase: SupabaseClient<Database>) {
    if (this.isInitialized && this.supabase === supabase) {
      console.log('[RealtimeConnectionManager] Already initialized with same client')
      return
    }

    console.log('[RealtimeConnectionManager] Initializing with Supabase client')
    this.supabase = supabase
    this.isInitialized = true

    // Set up the main realtime channel
    try {
      await this.setupRealtimeSubscriptions()
    } catch (error) {
      console.error('[RealtimeConnectionManager] Failed to setup subscriptions:', error)
      this.isInitialized = false
      throw error
    }
  }

  private async setupRealtimeSubscriptions() {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized')
    }

    // Clean up any existing channel first
    if (this.currentChannel) {
      console.log('[RealtimeConnectionManager] Cleaning up existing channel')
      this.currentChannel.unsubscribe()
      this.currentChannel = null
    }

    console.log('[RealtimeConnectionManager] Setting up realtime subscriptions')

    // Emit connecting state
    eventManager.emitConnectionEvent({
      type: 'reconnecting',
      message: 'Establishing realtime connection...',
      timestamp: Date.now()
    })

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

    // Store channel reference
    this.currentChannel = channel

    // Subscribe and handle connection states
    channel.subscribe((status, err) => {
      console.log('[RealtimeConnectionManager] Channel status:', status, err ? 'Error:' : '', err)
      
      if (status === 'SUBSCRIBED') {
        console.log('[RealtimeConnectionManager] Successfully subscribed to realtime channel')
        this.isReconnecting = false
        eventManager.emitConnectionEvent({
          type: 'connected',
          message: 'Realtime channel subscribed',
          timestamp: Date.now()
        })
        eventManager.resetReconnection()
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[RealtimeConnectionManager] Channel error:', err)
        eventManager.emitConnectionEvent({
          type: 'error',
          message: `Channel error: ${err?.message || 'WebSocket connection failed'}`,
          timestamp: Date.now()
        })
        // Schedule reconnection only if not already reconnecting
        if (!this.isReconnecting) {
          this.isReconnecting = true
          eventManager.scheduleReconnect(async () => {
            await this.reconnect()
          })
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('[RealtimeConnectionManager] Channel timed out')
        eventManager.emitConnectionEvent({
          type: 'disconnected',
          message: 'Channel timed out',
          timestamp: Date.now()
        })
        // Schedule reconnection only if not already reconnecting
        if (!this.isReconnecting) {
          this.isReconnecting = true
          eventManager.scheduleReconnect(async () => {
            await this.reconnect()
          })
        }
      } else if (status === 'CLOSED') {
        console.warn('[RealtimeConnectionManager] Channel closed')
        eventManager.emitConnectionEvent({
          type: 'disconnected',
          message: 'Channel closed',
          timestamp: Date.now()
        })
        // Don't auto-reconnect on manual close
        this.isReconnecting = false
      } else {
        console.log('[RealtimeConnectionManager] Channel status update:', status)
      }
    })

    // Register the channel with event manager
    eventManager.registerChannel('database-changes', channel)
  }

  // Reconnect to realtime
  private async reconnect() {
    if (!this.supabase) {
      console.error('[RealtimeConnectionManager] Cannot reconnect: Supabase client not initialized')
      this.isReconnecting = false
      return
    }

    console.log('[RealtimeConnectionManager] Attempting to reconnect...')
    
    try {
      // Unregister old channel
      eventManager.unregisterChannel('database-changes')
      
      // Wait a bit before reconnecting to avoid rapid reconnection
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Set up new subscriptions
      await this.setupRealtimeSubscriptions()
    } catch (error) {
      console.error('[RealtimeConnectionManager] Reconnection failed:', error)
      this.isReconnecting = false
      throw error
    }
  }

  // Manual disconnect
  public disconnect() {
    console.log('[RealtimeConnectionManager] Disconnecting...')
    this.isReconnecting = false
    if (this.currentChannel) {
      this.currentChannel.unsubscribe()
      this.currentChannel = null
    }
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