-- Migration: Enable single institution access for MVP
-- Description: Updates RLS policies to allow all authenticated users within a single institution
-- to access all patient and schedule data for collaborative care management

BEGIN;

-- ========================================
-- PROFILES TABLE: Allow viewing all profiles
-- ========================================
-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create new policy allowing all authenticated users to view all profiles
-- This enables staff to see colleague information for proper assignment
CREATE POLICY "All authenticated users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Keep existing policies for INSERT and UPDATE to maintain user control over their own profile
-- These policies are already in place and don't need modification

-- ========================================
-- SCHEDULES TABLE: Clean up conflicting policies
-- ========================================
-- The schedules table has multiple overlapping policies causing confusion
-- We'll consolidate them for clarity

-- Drop conflicting/redundant policies
DROP POLICY IF EXISTS "prevent_delete_schedules" ON schedules;
DROP POLICY IF EXISTS "schedules_delete_policy" ON schedules;
DROP POLICY IF EXISTS "schedules_insert_policy" ON schedules;
DROP POLICY IF EXISTS "schedules_select_policy" ON schedules;
DROP POLICY IF EXISTS "schedules_update_policy" ON schedules;
DROP POLICY IF EXISTS "insert_schedules" ON schedules;
DROP POLICY IF EXISTS "update_schedules" ON schedules;
DROP POLICY IF EXISTS "view_schedules" ON schedules;

-- Keep only the simple, permissive policies for single institution use
-- These policies already exist but we'll recreate them for clarity
DROP POLICY IF EXISTS "Users can view all schedules" ON schedules;
DROP POLICY IF EXISTS "Users can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Users can update schedules" ON schedules;
DROP POLICY IF EXISTS "Users can delete schedules" ON schedules;

-- Recreate clean, simple policies for schedules
CREATE POLICY "Authenticated users can view all schedules"
ON schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert schedules"
ON schedules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all schedules"
ON schedules FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- For deletion, we'll be slightly more restrictive to prevent accidental data loss
-- Only allow soft deletes (which the application handles via deleted_at field)
CREATE POLICY "Authenticated users can soft delete schedules"
ON schedules FOR DELETE
TO authenticated
USING (false);  -- Prevent hard deletes, use soft delete via UPDATE deleted_at instead

-- ========================================
-- PATIENTS TABLE: Already configured correctly
-- ========================================
-- The patients table already has appropriate policies:
-- - view_patients: SELECT with qual="true" (all authenticated users can view)
-- - insert_patients: INSERT with check="true" (all authenticated users can insert)
-- - update_patients: UPDATE with qual="true" (all authenticated users can update)
-- - delete_patients: DELETE with qual="false" (prevents hard deletes, use soft delete)
-- No changes needed

-- ========================================
-- NOTIFICATIONS TABLE (Optional Enhancement)
-- ========================================
-- Check if notifications table exists and update if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications') THEN
        -- Drop any existing user-specific policies
        DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
        DROP POLICY IF EXISTS "Authenticated users can view all notifications" ON notifications;
        
        -- Create new policy for viewing all notifications (useful for system-wide announcements)
        EXECUTE 'CREATE POLICY "Authenticated users can view all notifications"
        ON notifications FOR SELECT
        TO authenticated
        USING (true)';
    END IF;
END $$;

-- ========================================
-- SCHEDULE_EXECUTIONS TABLE: Already configured correctly
-- ========================================
-- Based on the initial analysis, this table already allows full access
-- No changes needed

-- ========================================
-- ITEMS TABLE: Already configured correctly
-- ========================================
-- Based on the initial analysis, this table already allows full access
-- No changes needed

COMMIT;

-- ========================================
-- VERIFICATION QUERIES (Run after migration)
-- ========================================
-- You can run these queries to verify the policies are correctly applied:

-- Check profiles policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- Check schedules policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'schedules';

-- Test access (replace with actual user IDs):
-- SELECT COUNT(*) FROM profiles; -- Should show all profiles
-- SELECT COUNT(*) FROM patients; -- Should show all patients
-- SELECT COUNT(*) FROM schedules WHERE deleted_at IS NULL; -- Should show all active schedules