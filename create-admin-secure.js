// Secure script to create admin account
// This version uses environment variables for sensitive data
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Load credentials from environment variables (New API Key System)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing required environment variables!');
  console.error('Please ensure the following are set in your .env file:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SECRET_KEY (New API Key System)');
  process.exit(1);
}

// Use secret key to bypass RLS (New API Key System)
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234!';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  
  console.log('Creating admin account...');
  console.log('Email:', adminEmail);
  
  // Step 1: Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      name: adminName,
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
      email: adminEmail,
      name: adminName,
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
  console.log('Email:', adminEmail);
  console.log('⚠️  Please change the password after first login!');
  
  return true;
}

createAdminAccount().then(success => {
  process.exit(success ? 0 : 1);
});