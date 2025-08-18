// Script to create admin account
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xlhtmakvxbdjnpvtzdqh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaHRtYWt2eGJkam5wdnR6ZHFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTMzMDY4NCwiZXhwIjoyMDcwOTA2Njg0fQ.C_UXwFyhxErAgjMoTimfq-Gdp0cOJw6gHheHn_bBikw';

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminAccount() {
  console.log('Creating admin account...');
  
  // Step 1: Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'cooldericesh@gmail.com',
    password: 'Admin@1234!', // Stronger temporary password
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      name: 'System Administrator',
      role: 'admin'
    }
  });
  
  if (authError) {
    console.error('❌ Failed to create auth user:', authError.message);
    return false;
  }
  
  console.log('✅ Auth user created:', authData.user.id);
  
  // Step 2: Create admin profile directly (bypassing trigger)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email: 'cooldericesh@gmail.com',
      name: 'System Administrator',
      role: 'admin',
      is_active: true,
      department: 'System Administration'
    })
    .select()
    .single();
  
  if (profileError) {
    console.error('❌ Failed to create profile:', profileError.message);
    return false;
  }
  
  console.log('✅ Admin profile created successfully!');
  console.log('Email: cooldericesh@gmail.com');
  console.log('Temporary Password: Admin@1234!');
  console.log('⚠️  Please change the password after first login!');
  
  return true;
}

createAdminAccount().then(success => {
  process.exit(success ? 0 : 1);
});