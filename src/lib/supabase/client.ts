import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
          heartbeatIntervalMs: 30000,  // Send heartbeat every 30 seconds
        },
        timeout: 20000,  // Increase timeout to 20 seconds
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
      },
    }
  );
}

// Client-side auth helper
export const supabaseClient = createClient();
