'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

// Singleton instance
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Return existing instance if available
  if (clientInstance) {
    return clientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required');
  }

  // Create and store singleton instance
  clientInstance = createBrowserClient<Database>(url, publishableKey);

  return clientInstance;
}

// Type export for use in other files
export type SupabaseClient = ReturnType<typeof createClient>
