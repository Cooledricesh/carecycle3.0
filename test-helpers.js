// Test helpers for Node.js environment
// This creates simplified Supabase clients that work outside Next.js

require('dotenv').config({ path: '.env.local' });
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required');
  }
  
  console.log('Creating Supabase client with URL:', url);
  
  return createSupabaseClient(url, publishableKey);
}

function createServiceClient() {
  // Browser runtime guard to prevent exposing secret keys in client bundles
  if (typeof window !== 'undefined') {
    throw new Error(
      'createServiceClient can only be used in server-side environments. ' +
      'Secret keys must never be exposed to the browser.'
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for admin operations');
  }

  // Create service client with server-only configuration
  return createSupabaseClient(url, secretKey, {
    auth: {
      persistSession: false,      // Never persist sessions on server
      detectSessionInUrl: false,  // Disable browser-specific URL detection
      autoRefreshToken: false,    // No automatic token refresh on server
      storage: undefined,         // No storage mechanism on server
      storageKey: undefined,      // No storage key needed
      flowType: 'implicit'        // Use implicit flow for service operations
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-node' // Identify as server-side client
      }
    },
    db: {
      schema: 'public'  // Use public schema by default
    },
    realtime: {
      params: {
        eventsPerSecond: 10  // Rate limit for realtime events if used
      }
    }
  });
}

module.exports = {
  createClient,
  createServiceClient
};