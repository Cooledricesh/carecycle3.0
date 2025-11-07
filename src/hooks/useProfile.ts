'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider-simple';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'nurse' | 'doctor';
  care_type: string | null;
  organization_id: string;
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
        .select('*')
        .eq('id', user.id)
        .single();

      try {
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error) {
          console.error('[useProfile] Error fetching profile:', error.message);
          return null;
        }

        return data;
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