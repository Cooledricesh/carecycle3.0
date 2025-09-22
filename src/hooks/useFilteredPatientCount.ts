'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from './useProfile'
import { useFilterContext } from '@/lib/filters/filter-context'

export function useFilteredPatientCount() {
  const { data: profile } = useProfile()
  const { filters } = useFilterContext()
  const supabase = createClient()

  // Get total patient count (all active patients)
  const { data: totalPatientCount = 0 } = useQuery({
    queryKey: ['total-patients-all'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching total patients:', error)
        return 0
      }

      console.log('[useFilteredPatientCount] Total active patients:', count)
      return count || 0
    },
    enabled: true
  })

  // Get "my patients" count for doctors and nurses
  const { data: myPatientCount = 0 } = useQuery({
    queryKey: ['my-patients', profile?.id, profile?.role, profile?.care_type],
    queryFn: async () => {
      if (!profile) return 0

      let query = supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)  // Always filter by active status

      // Filter based on role
      if (profile.role === 'doctor') {
        query = query.eq('doctor_id', profile.id)
      } else if (profile.role === 'nurse' && profile.care_type) {
        query = query.eq('care_type', profile.care_type)
      } else if (profile.role === 'admin') {
        // Admin sees all active patients
        const { count, error } = await query
        if (error) {
          console.error('Error fetching admin patients:', error)
          return 0
        }
        return count || 0
      }

      const { count, error } = await query

      if (error) {
        console.error('Error fetching my patients:', error)
        return 0
      }

      console.log('[useFilteredPatientCount] My patients count:', {
        role: profile.role,
        careType: profile.care_type,
        count
      })

      return count || 0
    },
    enabled: !!profile
  })

  return {
    myPatientCount: myPatientCount,
    totalCount: totalPatientCount,
    isLoading: false,
    isShowingAll: filters.showAll === true,
    role: profile?.role,
    careType: profile?.care_type
  }
}