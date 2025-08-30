'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Single, shared Supabase client for the entire application
let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    // Detect environment
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.VERCEL_ENV === 'production' ||
                        (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    
    // Log environment for debugging
    if (typeof window !== 'undefined') {
      console.log(`[Supabase Client] Environment: ${isProduction ? 'Production' : 'Development'}`)
    }
    
    supabaseClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // CRITICAL: Disable session persistence in development to prevent stuck sessions
          autoRefreshToken: isProduction,
          persistSession: isProduction,
          detectSessionInUrl: false, // Prevent redirect loops
          flowType: 'pkce', // Always use PKCE for security
          
          // Only store in production
          ...(isProduction && {
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            storageKey: 'carecycle-auth',
          }),
          
          // Cookie settings
          cookieOptions: {
            name: 'carecycle-auth',
            lifetime: 60 * 60 * 8, // 8 hours
            secure: isProduction,
            sameSite: 'lax',
          },
        },
        realtime: {
          params: {
            eventsPerSecond: isProduction ? 2 : 10,
            heartbeatIntervalMs: isProduction ? 60000 : 30000,
          },
          timeout: isProduction ? 45000 : 20000,
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-js/carecycle',
          },
        },
      }
    );
  }
  
  return supabaseClient;
}

// Export for backward compatibility
export const createClient = getSupabaseClient;
