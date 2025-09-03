// Test signup functionality
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xlhtmakvxbdjnpvtzdqh.supabase.co';
const supabasePublishableKey = 'sb_publishable_test_xlhtmakvxbdjnpvtzdqh_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaHRtYWt2eGJkam5wdnR6ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMzA2ODQsImV4cCI6MjA3MDkwNjY4NH0QpfEbVS4zTsBg5F1TT9-ZDkb9AtnLaaTvQ0kh1MCKdQ';

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