// Test the approval system
// IMPORTANT: Using helper functions instead of direct import for new API key system

// Load environment variables from .env.local file
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const { createClient } = require('./src/lib/supabase/client.js');
const { createServiceClient } = require('./src/lib/supabase/server.js');

// Environment variables are validated by helper functions
// The helper functions will use process.env variables loaded by dotenv

async function testApprovalSystem() {
  console.log('=== Testing Approval System ===\n');
  
  // Validate test credentials from environment
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  
  if (!adminEmail || !adminPassword) {
    console.error('❌ Missing test credentials:');
    console.error('  - TEST_ADMIN_EMAIL:', adminEmail ? '✓' : '❌');
    console.error('  - TEST_ADMIN_PASSWORD:', adminPassword ? '✓ (HIDDEN)' : '❌');
    console.error('\nPlease set these environment variables in your .env.local file');
    process.exit(1);
  }
  
  // 1. Test admin login
  console.log('1. Testing admin login...');
  const adminClient = createClient();
  
  const { data: adminAuth, error: adminError } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });
  
  if (adminError) {
    console.error('❌ Admin login failed:', adminError.message);
    return;
  }
  console.log('✅ Admin logged in successfully\n');
  
  // 2. Check admin profile
  const { data: adminProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', adminAuth.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Failed to fetch admin profile:', profileError.message);
  } else {
    console.log('✅ Admin profile:', {
      name: adminProfile.name,
      role: adminProfile.role,
      approval_status: adminProfile.approval_status,
      is_active: adminProfile.is_active
    });
  }
  
  // 3. Create a test user (nurse)
  console.log('\n2. Creating test nurse account...');
  const nurseEmail = `nurse${Date.now()}@hospital.kr`;
  const testPassword = process.env.TEST_USER_PASSWORD || 'Test@1234!';
  const userClient = createClient();
  
  const { data: nurseAuth, error: nurseError } = await userClient.auth.signUp({
    email: nurseEmail,
    password: testPassword,
    options: {
      data: {
        name: 'Test Nurse',
        role: 'nurse'
      }
    }
  });
  
  if (nurseError) {
    console.error('❌ Nurse signup failed:', nurseError.message);
    return;
  }
  console.log('✅ Nurse account created:', nurseAuth.user.id);
  
  // 4. Check nurse profile status (should be pending)
  const serviceClient = await createServiceClient();
  const { data: nurseProfile, error: nurseProfileError } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', nurseAuth.user.id)
    .single();
  
  if (nurseProfileError) {
    console.error('❌ Failed to fetch nurse profile:', nurseProfileError.message);
  } else {
    console.log('✅ Nurse profile status:', {
      name: nurseProfile.name,
      role: nurseProfile.role,
      approval_status: nurseProfile.approval_status,
      is_active: nurseProfile.is_active
    });
  }
  
  // 5. Test nurse login (should work but with limited access)
  console.log('\n3. Testing nurse login before approval...');
  const { data: nurseLogin, error: nurseLoginError } = await userClient.auth.signInWithPassword({
    email: nurseEmail,
    password: testPassword
  });
  
  if (nurseLoginError) {
    console.error('❌ Nurse login failed:', nurseLoginError.message);
  } else {
    console.log('✅ Nurse can login (but with pending status)');
  }
  
  // 6. Admin approves the nurse
  console.log('\n4. Admin approving nurse account...');
  const { data: approvalResult, error: approvalError } = await adminClient.rpc('approve_user', {
    target_user_id: nurseAuth.user.id
  });
  
  if (approvalError) {
    console.error('❌ Approval failed:', approvalError.message);
  } else {
    console.log('✅ Nurse approved by admin');
  }
  
  // 7. Check nurse profile after approval
  const { data: approvedProfile, error: approvedError } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', nurseAuth.user.id)
    .single();
  
  if (approvedError) {
    console.error('❌ Failed to fetch approved profile:', approvedError.message);
  } else {
    console.log('✅ Nurse profile after approval:', {
      approval_status: approvedProfile.approval_status,
      is_active: approvedProfile.is_active,
      approved_by: approvedProfile.approved_by,
      approved_at: approvedProfile.approved_at
    });
  }
  
  // 8. Test viewing all pending users as admin
  console.log('\n5. Admin viewing all pending users...');
  const { data: pendingUsers, error: pendingError } = await adminClient
    .from('profiles')
    .select('id, email, name, role, approval_status')
    .eq('approval_status', 'pending');
  
  if (pendingError) {
    console.error('❌ Failed to fetch pending users:', pendingError.message);
  } else {
    console.log(`✅ Found ${pendingUsers.length} pending users`);
    if (pendingUsers.length > 0) {
      console.log('Pending users:', pendingUsers);
    }
  }
  
  console.log('\n=== Approval System Test Complete ===');
}

testApprovalSystem().catch(console.error);