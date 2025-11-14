-- Migration: Add INSERT policy for profiles table to allow trigger function
-- Bug ID: BUG-20251114-003
-- Reason: handle_new_user() trigger function needs to INSERT into profiles
-- Context: Supabase new API key system - SECURITY DEFINER also follows RLS
-- Pattern: Same as organization_requests (BUG-20251114-002)

BEGIN;

-- Drop policy if exists (idempotent)
DROP POLICY IF EXISTS "profiles_insert_from_trigger" ON profiles;

-- Create policy to allow INSERT from trigger context
-- This policy works alongside profiles_insert_own (OR relationship)
-- Either policy passing allows the INSERT to proceed
CREATE POLICY "profiles_insert_from_trigger"
ON profiles FOR INSERT
WITH CHECK (
  -- Condition 1: User must exist in auth.users
  -- This validates that the profile being created has a valid auth user
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = profiles.id
  )
  -- Condition 2: Initial status must be pending
  -- This ensures data integrity - new users start as pending
  AND approval_status = 'pending'
);

COMMIT;

-- Add comment for documentation
COMMENT ON POLICY "profiles_insert_from_trigger" ON profiles IS
'Allows INSERT from handle_new_user() trigger when: 1) User exists in auth.users, 2) Status is pending. Works alongside profiles_insert_own policy (OR relationship).';
