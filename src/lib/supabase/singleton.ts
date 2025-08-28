'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Create a single, shared Supabase client for the entire application
let supabaseClient: SupabaseClient<Database> | null = null;

function createSupabaseClient() {
  // Detect production environment
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.VERCEL_ENV === 'production' ||
                       typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  
  // Log environment for debugging
  if (typeof window !== 'undefined') {
    console.log(`[Supabase Singleton] Environment: ${isProduction ? 'Production' : 'Development'}`)
  }
  
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: isProduction ? 2 : 10, // Reduced for production stability
          heartbeatIntervalMs: isProduction ? 60000 : 30000, // 60s in prod, 30s in dev
        },
        timeout: isProduction ? 45000 : 20000, // Longer timeout for production (45s)
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-js/carecycle',
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Production-specific auth settings
        flowType: isProduction ? 'pkce' : 'implicit', // More secure flow for production
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'carecycle-auth-token', // Explicit storage key
        cookieOptions: {
          name: 'carecycle-auth',
          lifetime: 60 * 60 * 8, // 8 hours
          secure: isProduction, // Secure cookies in production
          sameSite: 'lax',
        },
      },
    }
  );
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}