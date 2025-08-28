'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Create a single, shared Supabase client for the entire application
let supabaseClient: SupabaseClient<Database> | null = null;

function createSupabaseClient() {
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

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}