'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !publishableKey) {
    console.error('Supabase environment variables missing:', { 
      url: !!url, 
      publishableKey: !!publishableKey 
    });
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required');
  }
  
  console.log('Creating Supabase client with URL:', url);
  
  return createBrowserClient<Database>(url, publishableKey);
}
