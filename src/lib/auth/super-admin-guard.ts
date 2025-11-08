import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Super Admin Guard - Server-side authentication middleware
 *
 * Validates that the current user has Super Admin role.
 * Used in API routes to protect Super Admin-only endpoints.
 *
 * @throws {Error} 'Unauthorized' if user is not authenticated
 * @throws {Error} 'Forbidden: Super Admin only' if user is not Super Admin
 * @returns {Promise<{ user, supabase }>} Authenticated user and Supabase client
 */
export async function requireSuperAdmin() {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify user has Super Admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userProfile = profile as Profile | null;

  if (!userProfile || userProfile.role !== 'super_admin') {
    throw new Error('Forbidden: Super Admin only');
  }

  return { user, supabase };
}
