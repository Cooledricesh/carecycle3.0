'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

// Singleton instance
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Return existing instance if available
  if (clientInstance) {
    console.log('[Supabase Client Debug] Reusing existing singleton instance');
    return clientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  console.log('[Supabase Client Debug] Environment variables:', {
    hasUrl: !!url,
    urlValue: url,
    hasKey: !!publishableKey,
    keyPrefix: publishableKey?.substring(0, 20) + '...'
  });

  if (!url || !publishableKey) {
    console.error('Supabase environment variables missing:', {
      url: !!url,
      publishableKey: !!publishableKey
    });
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required');
  }

  console.log('[Supabase Client Debug] Creating new singleton instance');

  // Create and store singleton instance
  clientInstance = createBrowserClient<Database>(url, publishableKey);

  console.log('[Supabase Client Debug] Client created successfully');

  return clientInstance;
}

// Type export for use in other files
export type SupabaseClient = ReturnType<typeof createClient>
