'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile, Profile } from '@/hooks/useProfile'

export interface Doctor {
  id: string
  name: string
  email: string
  department_id: string | null
  department_name: string | null
  is_active: boolean
}

export function useDoctors() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['doctors', typedProfile?.organization_id],
    queryFn: async (): Promise<Doctor[]> => {
      try {
        if (!typedProfile?.organization_id) {
          console.warn('[useDoctors] No organization_id available')
          return []
        }

        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            name,
            email,
            department_id,
            departments:department_id (
              name
            ),
            is_active
          `)
          .eq('role', 'doctor')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .eq('organization_id', typedProfile.organization_id)
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching doctors:', error)
          throw error
        }

        console.log(`[useDoctors] Fetched ${data?.length || 0} doctors for organization ${typedProfile.organization_id}`)

        // Transform data to match Doctor interface
        const doctors: Doctor[] = (data || []).map((doctor: any) => ({
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          department_id: doctor.department_id,
          department_name: doctor.departments?.name || null,
          is_active: doctor.is_active,
        }))

        return doctors
      } catch (error) {
        console.error('Error in useDoctors:', error)
        throw new Error('의사 목록을 불러오는 중 오류가 발생했습니다')
      }
    },
    enabled: !!user && !!typedProfile?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}