'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/auth-provider-simple'

export interface Doctor {
  id: string
  name: string
  email: string
  care_type: string | null
  is_active: boolean
}

export function useDoctors() {
  const { user } = useAuth()
  const supabase = createClient()

  return useQuery({
    queryKey: ['doctors'],
    queryFn: async (): Promise<Doctor[]> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, care_type, is_active')
          .eq('role', 'doctor')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching doctors:', error)
          throw error
        }

        return data || []
      } catch (error) {
        console.error('Error in useDoctors:', error)
        throw new Error('의사 목록을 불러오는 중 오류가 발생했습니다')
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}