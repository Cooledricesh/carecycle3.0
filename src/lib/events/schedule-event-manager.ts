'use client'

type EventCallback = (data?: any) => void

class SimpleEventManager {
  private listeners = new Map<string, Set<EventCallback>>()

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  subscribeToScheduleChanges(callback: EventCallback): () => void {
    return this.subscribe('schedule-changed', callback)
  }

  emitScheduleChange(data?: any) {
    this.emit('schedule-changed', data)
  }

  subscribeToPatientChanges(callback: EventCallback): () => void {
    return this.subscribe('patient-changed', callback)
  }

  emitPatientChange(data?: any) {
    this.emit('patient-changed', data)
  }

  subscribeToProfileChanges(callback: EventCallback): () => void {
    return this.subscribe('profile-changed', callback)
  }

  emitProfileChange(data?: any) {
    this.emit('profile-changed', data)
  }
}

export const eventManager = new SimpleEventManager()