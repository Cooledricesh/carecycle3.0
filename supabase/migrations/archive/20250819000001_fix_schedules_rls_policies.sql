-- ============================================================================
-- Fix RLS policies for schedules table
-- Date: 2025-08-19
-- Description: Add proper INSERT, SELECT, UPDATE, DELETE policies
-- ============================================================================

BEGIN;

-- Drop existing policy that's too restrictive
DROP POLICY IF EXISTS "nurses_manage_schedules" ON schedules;
DROP POLICY IF EXISTS "Users can view all schedules" ON schedules;
DROP POLICY IF EXISTS "Users can manage schedules" ON schedules;

-- Create separate policies for different operations

-- 1. SELECT: All authenticated users can view schedules
CREATE POLICY "schedules_select_policy" ON schedules
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. INSERT: Authenticated users can create schedules
CREATE POLICY "schedules_insert_policy" ON schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow insert if user is authenticated
        auth.uid() IS NOT NULL
        -- Automatically set created_by to current user if provided
        AND (created_by IS NULL OR created_by = auth.uid())
    );

-- 3. UPDATE: Users can update schedules they created or are assigned to
CREATE POLICY "schedules_update_policy" ON schedules
    FOR UPDATE
    TO authenticated
    USING (
        assigned_nurse_id = auth.uid() 
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
            AND profiles.is_active = true
        )
    )
    WITH CHECK (
        assigned_nurse_id = auth.uid() 
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
            AND profiles.is_active = true
        )
    );

-- 4. DELETE: Users can delete schedules they created or admins
CREATE POLICY "schedules_delete_policy" ON schedules
    FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
            AND profiles.is_active = true
        )
    );

COMMIT;