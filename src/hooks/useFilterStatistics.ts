'use client'

import { useEffect, useState } from 'react'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { FilterStatistics } from '@/services/filters'
import type { UserProfile } from '@/types/user'

interface UseFilterStatisticsReturn {
  statistics: FilterStatistics | null
  urgentCount: number
}

export function useFilterStatistics(profile: UserProfile | null | undefined): UseFilterStatisticsReturn {
  const [statistics, setStatistics] = useState<FilterStatistics | null>(null)
  const [urgentCount, setUrgentCount] = useState(0)

  useEffect(() => {
    if (!profile) {
      setStatistics(null)
      setUrgentCount(0)
      return
    }

    const fetchStats = async () => {
      try {
        const userContext = {
          userId: profile.id,
          role: profile.role,
          careType: profile.care_type
        }

        const stats = await scheduleServiceEnhanced.getFilterStatistics(userContext)

        if (stats) {
          setStatistics(stats)
          // Calculate urgent count (overdue + today)
          const urgent = (stats.overdueSchedules || 0) + (stats.todaySchedules || 0)
          setUrgentCount(urgent)
        }
      } catch (error) {
        console.error('[useFilterStatistics] Failed to fetch statistics:', error)
        // Keep current state on error to avoid flickering
      }
    }

    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.care_type])

  return { statistics, urgentCount }
}