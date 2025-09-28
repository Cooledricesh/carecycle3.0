-- Fix profiles table RLS policies
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create completely open policies for profiles (temporary fix)
CREATE POLICY "profiles_allow_all_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_allow_all_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_allow_all_update" ON profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "profiles_allow_all_delete" ON profiles FOR DELETE USING (true);

COMMIT;