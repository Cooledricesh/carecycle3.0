import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../database.types";

export function createClient() {
  // Detect production environment
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.VERCEL_ENV === 'production' ||
                       typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  
  // Log environment for debugging
  if (typeof window !== 'undefined') {
    console.log(`[Supabase Client] Environment: ${isProduction ? 'Production' : 'Development'}`)
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

// Client-side auth helper
export const supabaseClient = createClient();
