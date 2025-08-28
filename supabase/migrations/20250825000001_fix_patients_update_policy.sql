-- Fix patients table RLS policies for proper update functionality
-- This migration drops ALL existing policies and recreates them properly

BEGIN;

-- First, drop ALL existing policies on patients table
DROP POLICY IF EXISTS "Users can view all patients" ON patients;
DROP POLICY IF EXISTS "Users can insert patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can view active patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can soft delete patients" ON patients;

-- Recreate policies with proper permissions

-- Policy for viewing patients (only active ones)
CREATE POLICY "view_patients" ON patients
    FOR SELECT
    TO authenticated
    USING (true);  -- Can see all patients (we filter is_active in the application)

-- Policy for inserting new patients
CREATE POLICY "insert_patients" ON patients
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy for updating patients (including soft delete)
-- No restrictions on USING or WITH CHECK to allow any updates
CREATE POLICY "update_patients" ON patients
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for hard delete (if ever needed, but we use soft delete)
CREATE POLICY "delete_patients" ON patients
    FOR DELETE
    TO authenticated
    USING (false);  -- Prevent hard deletes, only soft deletes allowed

-- Add comments explaining the policies
COMMENT ON POLICY "view_patients" ON patients IS 
    'Allows authenticated users to view all patient records';
    
COMMENT ON POLICY "insert_patients" ON patients IS 
    'Allows authenticated users to create new patient records';
    
COMMENT ON POLICY "update_patients" ON patients IS 
    'Allows authenticated users to update any patient record, including soft deletes';
    
COMMENT ON POLICY "delete_patients" ON patients IS 
    'Prevents hard deletes - only soft deletes (is_active=false) are allowed';

COMMIT;