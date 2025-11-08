'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile, Profile } from '@/hooks/useProfile'

/**
 * Department interface - mapped to departments table (Phase 2 complete)
 */
export interface Department {
  id: string // departments.id (UUID)
  name: string // departments.name (소속명)
}

/**
 * Fetches departments from departments table (Phase 2 complete)
 * Returns departments for the current user's organization
 */
export function useDepartments() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const supabase = createClient()

  return useQuery({
    queryKey: ['departments', typedProfile?.organization_id],
    queryFn: async (): Promise<Department[]> => {
      try {
        if (!typedProfile?.organization_id) {
          console.warn('[useDepartments] No organization_id available')
          return []
        }

        // PHASE 2 IMPLEMENTATION: Query departments table directly
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, display_order')
          .eq('organization_id', typedProfile.organization_id)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching departments:', error)
          throw error
        }

        // Data is already in correct format { id, name }
        const departments: Department[] = (data || []).map((dept: any) => ({
          id: dept.id,
          name: dept.name
        }))

        console.log(`[useDepartments] Fetched ${departments.length} departments for organization ${typedProfile.organization_id}`)
        return departments
      } catch (error) {
        console.error('Error in useDepartments:', error)
        throw new Error('소속 목록을 불러오는 중 오류가 발생했습니다')
      }
    },
    enabled: !!user && !!typedProfile?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Phase 2 Migration Status: ✅ COMPLETE
 * - departments table created
 * - department_id columns added to profiles and patients
 * - Data backfilled from care_type
 * - Application code updated to use departments table
 * - Next: Phase 2.1.5 will drop care_type columns
 */
