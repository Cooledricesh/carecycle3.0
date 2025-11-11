'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProfile, Profile } from './useProfile'
import { useFilterContext } from '@/lib/filters/filter-context'

export function useFilteredPatientCount() {
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const { filters } = useFilterContext()
  const supabase = createClient()

  // Get total patient count (all active patients in organization)
  const { data: totalPatientCount = 0 } = useQuery({
    queryKey: ['total-patients-all', typedProfile?.organization_id],
    queryFn: async () => {
      if (!typedProfile?.organization_id) return 0

      const { count, error } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('organization_id', typedProfile.organization_id)

      if (error) {
        console.error('Error fetching total patients:', error)
        return 0
      }

      console.log('[useFilteredPatientCount] Total active patients:', count)
      return count || 0
    },
    enabled: !!typedProfile?.organization_id
  })

  // Get "my patients" count for doctors and nurses
  const { data: myPatientCount = 0 } = useQuery({
    queryKey: ['my-patients', profile?.id, typedProfile?.role, typedProfile?.care_type, typedProfile?.organization_id, typedProfile?.department_id],
    queryFn: async () => {
      if (!profile || !typedProfile || !typedProfile.organization_id) return 0

      let query = supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)  // Always filter by active status
        .eq('organization_id', typedProfile.organization_id)  // Filter by organization

      // Filter based on role
      if (typedProfile.role === 'doctor') {
        query = query.eq('doctor_id', profile.id)
      } else if (typedProfile.role === 'nurse' && typedProfile.department_id) {
        query = query.eq('department_id', typedProfile.department_id)
      } else if (typedProfile.role === 'admin') {
        // Admin sees all active patients in their organization (already filtered above)
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
        role: typedProfile.role,
        departmentId: typedProfile.department_id,
        count
      })

      return count || 0
    },
    enabled: !!profile && !!typedProfile?.organization_id
  })

  return {
    myPatientCount: myPatientCount,
    totalCount: totalPatientCount,
    isLoading: false,
    isShowingAll: filters.showAll === true,
    role: typedProfile?.role,
    careType: typedProfile?.care_type
  }
}