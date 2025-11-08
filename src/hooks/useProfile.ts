'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider-simple';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'nurse' | 'doctor' | 'super_admin';
  care_type: string | null; // Deprecated: use department_name instead (kept for Phase 2 transition)
  department_id: string | null; // FK to departments table
  department_name: string | null; // Joined from departments table
  organization_id: string | null; // Allow null for super_admin
  organization_name: string | null; // Joined from organizations table
  phone?: string | null;
  is_active?: boolean;
  created_at: string | null;
  updated_at: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected' | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const supabase = createClient();

  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      // Add timeout protection (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Profile fetch timeout after 10s')), 10000);
      });

      const queryPromise = supabase
        .from('profiles')
        .select(`
          *,
          organization_name:organizations(name),
          department_name:departments(name)
        `)
        .eq('id', user.id)
        .single();

      try {
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error) {
          console.error('[useProfile] Error fetching profile:', error.message);
          return null;
        }

        // Transform nested organization and department data to flat structure
        if (data) {
          const rawData = data as any;
          const organizationData = rawData.organization_name;
          const departmentData = rawData.department_name;

          // Extract all profile fields (exclude nested objects)
          const { organization_name: orgNameNested, department_name: deptNameNested, ...profileFields } = rawData;

          return {
            ...profileFields,
            organization_name: organizationData?.name || null,
            department_name: departmentData?.name || null
          } as Profile;
        }

        return null;
      } catch (timeoutError: any) {
        console.error('[useProfile] Query timeout:', timeoutError.message);
        return null;
      } finally {
        // Clean up timeout to prevent memory leak
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Only retry once to avoid extended hangs
    retryDelay: 1000, // Short retry delay
  });
}