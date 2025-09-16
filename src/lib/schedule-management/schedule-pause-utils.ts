'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Get the actual date when a schedule was paused by checking schedule_logs
 * Falls back to updatedAt if no log entry is found
 */
export async function getSchedulePausedDate(scheduleId: string): Promise<Date | null> {
  const supabase = createClient()

  try {
    // Query schedule_logs for the most recent active->paused transition
    const { data, error } = await supabase
      .from('schedule_logs')
      .select('changed_at, old_values, new_values')
      .eq('schedule_id', scheduleId)
      .or('action.eq.status_change_active_to_paused,action.eq.status_change')
      .order('changed_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching schedule pause date:', error)
      return null
    }

    if (data && data.length > 0) {
      const log = data[0]
      // Check if this was actually an active->paused transition
      if (log.old_values?.status === 'active' && log.new_values?.status === 'paused') {
        return new Date(log.changed_at)
      }
      // For older logs that use different action format
      if (log.new_values?.status === 'paused') {
        return new Date(log.changed_at)
      }
    }

    return null
  } catch (error) {
    console.error('Error in getSchedulePausedDate:', error)
    return null
  }
}

/**
 * Get pause date synchronously from schedule's updatedAt field
 * This is less accurate but doesn't require an async call
 */
export function getSchedulePausedDateSync(schedule: { updatedAt: string | Date }): Date {
  if (typeof schedule.updatedAt === 'string') {
    return new Date(schedule.updatedAt)
  }
  return schedule.updatedAt
}