// Secure script to create admin account
// This version uses environment variables for sensitive data
require('dotenv').config();
// IMPORTANT: Using helper functions for new API key system
const { createServiceClient } = require('./src/lib/supabase/server.js');

async function createAdminAccount() {
  // Validate required environment variables
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  
  if (!adminEmail || !adminPassword) {
    console.error('❌ Missing required admin credentials!');
    console.error('Please ensure the following are set in your .env.local file:');
    console.error('- ADMIN_EMAIL:', adminEmail ? '✓' : '❌');
    console.error('- ADMIN_PASSWORD:', adminPassword ? '✓ (HIDDEN)' : '❌');
    console.error('- ADMIN_NAME:', adminName);
    console.error('\n🚨 NEVER use default passwords in production!');
    process.exit(1);
  }
  
  // Use helper function for service client
  const supabase = await createServiceClient();
  
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