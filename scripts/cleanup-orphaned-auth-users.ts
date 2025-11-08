/**
 * Cleanup Orphaned Auth Users Script
 *
 * This script identifies and optionally deletes auth.users entries that don't have
 * corresponding profiles. These "orphaned" users can occur when signup fails after
 * creating the auth user but before creating the profile.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-auth-users.ts [--dry-run] [--delete]
 *
 * Options:
 *   --dry-run: Show orphaned users without deleting (default)
 *   --delete: Actually delete orphaned users (use with caution!)
 */

import { createServiceClient } from '../src/lib/supabase/server';

async function findOrphanedAuthUsers() {
  const supabase = await createServiceClient();

  console.log('🔍 Checking for orphaned auth users...\n');

  // Get all auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Failed to list auth users:', authError);
    process.exit(1);
  }

  console.log(`📊 Found ${authUsers.users.length} total auth users`);

  // Get all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email');

  if (profilesError || !profiles) {
    console.error('❌ Failed to list profiles:', profilesError);
    process.exit(1);
  }

  console.log(`📊 Found ${profiles.length} profiles\n`);

  // Create a Set of profile emails for faster lookup
  const profileEmails = new Set(profiles.map((p: { id: string; email: string }) => p.email));

  // Find orphaned users
  const orphanedUsers = authUsers.users.filter(user => {
    return user.email && !profileEmails.has(user.email);
  });

  return { orphanedUsers, supabase };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--delete');

  const { orphanedUsers, supabase } = await findOrphanedAuthUsers();

  if (orphanedUsers.length === 0) {
    console.log('✅ No orphaned auth users found!');
    process.exit(0);
  }

  console.log(`⚠️  Found ${orphanedUsers.length} orphaned auth users:\n`);

  orphanedUsers.forEach((user, index) => {
    console.log(`${index + 1}. Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('');
  });

  if (isDryRun) {
    console.log('ℹ️  DRY RUN MODE: No users were deleted.');
    console.log('💡 To delete these orphaned users, run with --delete flag:');
    console.log('   npx tsx scripts/cleanup-orphaned-auth-users.ts --delete\n');
    process.exit(0);
  }

  // Delete orphaned users
  console.log('🗑️  Deleting orphaned users...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const user of orphanedUsers) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id);

      if (error) {
        console.error(`❌ Failed to delete ${user.email}:`, error.message);
        failureCount++;
      } else {
        console.log(`✅ Deleted ${user.email}`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error deleting ${user.email}:`, error);
      failureCount++;
    }
  }

  console.log('\n📊 Cleanup Summary:');
  console.log(`   ✅ Successfully deleted: ${successCount}`);
  console.log(`   ❌ Failed to delete: ${failureCount}`);
}

main().catch(console.error);
