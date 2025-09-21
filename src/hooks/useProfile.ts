'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider-simple';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'nurse';
  care_type: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const supabase = createClient();

  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useProfile] No user ID available');
        return null;
      }

      console.log('[useProfile] Fetching profile for user:', user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[useProfile] Error fetching profile:', error);
        console.error('[useProfile] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return null;
      }

      console.log('[useProfile] Profile fetched successfully:', data);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}