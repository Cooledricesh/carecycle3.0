// Vitest setup file
// Learn more: https://vitest.dev/config/#setupfiles

// Mock environment variables for tests with new Supabase API key system
// These are MOCK values for testing only, not real credentials
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-test-project.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'mock_publishable_key_for_testing'
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'mock_secret_key_for_testing'