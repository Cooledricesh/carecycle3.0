'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/auth-provider-simple'
import { useProfile, Profile } from '@/hooks/useProfile'

/**
 * Department interface - abstracted for easy migration to departments table in Phase 2
 * Currently maps to care_type field, will map to departments.id in Phase 2
 */
export interface Department {
  id: string // Currently care_type value, will be UUID in Phase 2
  name: string // Display name
}

/**
 * Temporary implementation: Fetches unique care_type values as departments
 * Phase 2 migration: Will query departments table instead
 *
 * Abstraction strategy:
 * - Returns { id, name } structure for easy migration
 * - id = care_type value (temporary)
 * - name = care_type value (temporary)
 * - In Phase 2: id will be departments.id (UUID), name will be departments.name
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

        // TEMPORARY IMPLEMENTATION: Query unique care_type values
        // Phase 2: Replace with: SELECT id, name FROM departments WHERE organization_id = ...
        const { data, error } = await supabase
          .from('profiles')
          .select('care_type')
          .eq('organization_id', typedProfile.organization_id)
          .not('care_type', 'is', null)

        if (error) {
          console.error('Error fetching departments:', error)
          throw error
        }

        // Extract unique care_type values
        const uniqueCareTypes = [...new Set(
          data?.map((p: any) => p.care_type).filter(Boolean)
        )] as string[]

        // Transform to Department interface for abstraction
        // This structure makes Phase 2 migration seamless
        const departments: Department[] = uniqueCareTypes.map(care_type => ({
          id: care_type, // Temporary: use care_type as id
          name: care_type // Temporary: use care_type as name
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
 * Phase 2 Migration Checklist:
 *
 * 1. Database Changes (in migration file):
 *    - CREATE TABLE departments (id UUID, name TEXT, organization_id UUID, ...)
 *    - ALTER TABLE profiles ADD COLUMN department_id UUID REFERENCES departments(id)
 *    - Backfill: INSERT departments from existing care_type values
 *    - UPDATE profiles SET department_id = (SELECT id FROM departments WHERE name = care_type)
 *
 * 2. Update this hook:
 *    - Change query: .from('departments').select('id, name')
 *    - Keep same return type: Department[]
 *    - No changes needed in consuming components!
 *
 * 3. Update Profile interface:
 *    - Add department_id: string | null
 *    - Keep care_type during transition period
 *
 * 4. Update all write operations:
 *    - Change from care_type to department_id
 *
 * 5. Final cleanup (separate migration):
 *    - DROP COLUMN care_type from profiles
 */
