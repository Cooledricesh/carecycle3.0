'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('Supabase environment variables missing:', { url: !!url, key: !!key });
    throw new Error('Supabase configuration is missing');
  }
  
  console.log('Creating Supabase client with URL:', url);
  
  return createBrowserClient<Database>(url, key);
}
