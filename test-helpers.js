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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for admin operations');
  }

  return createSupabaseClient(url, secretKey);
}

module.exports = {
  createClient,
  createServiceClient
};