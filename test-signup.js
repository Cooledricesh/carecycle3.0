// Test signup functionality
const { createClient } = require('@supabase/supabase-js');

// Environment variables for secure API key access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabasePublishableKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
  console.error('  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', supabasePublishableKey ? '✓' : '❌');
  console.error('\nPlease set these environment variables in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function testSignup() {
  const testEmail = `nurse${Date.now()}@hospital.kr`;
  const testPassword = 'TestPassword123!';
  
  console.log('Testing signup with:', testEmail);
  
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        name: 'Test User',
        role: 'nurse'
      }
    }
  });
  
  if (error) {
    console.error('❌ Signup failed:', error.message);
    return false;
  }
  
  console.log('✅ Signup successful!');
  console.log('User ID:', data.user?.id);
  
  // Check if profile was created
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user?.id)
    .single();
  
  if (profileError) {
    console.error('❌ Profile check failed:', profileError.message);
  } else {
    console.log('✅ Profile created successfully:', profile);
  }
  
  return true;
}

testSignup().then(success => {
  process.exit(success ? 0 : 1);
});