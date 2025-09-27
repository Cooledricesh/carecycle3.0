-- Migration: Fix conflicting RLS policies causing 42P17 error
-- Error 42P17: "cannot determine result type" typically occurs when PostgreSQL
-- encounters ambiguous or conflicting policies
--
-- ROOT CAUSE: Multiple overlapping UPDATE policies on patients table:
-- 1. "patients_secure_update" - requires is_user_active_and_approved()
-- 2. "doctors_update_own_patients" - complex logic for doctor assignments
-- 3. "authenticated_users_update_patients" - our new policy
--
-- These policies create ambiguity in PostgreSQL's policy resolution,
-- especially when combining USING and WITH CHECK clauses.

BEGIN;

-- ========================================
-- STEP 1: Drop ALL existing UPDATE policies to eliminate conflicts
-- ========================================
-- We need a clean slate to implement a single, comprehensive policy

DROP POLICY IF EXISTS "patients_secure_update" ON patients;
DROP POLICY IF EXISTS "doctors_update_own_patients" ON patients;
DROP POLICY IF EXISTS "authenticated_users_update_patients" ON patients;
DROP POLICY IF EXISTS "update_patients" ON patients;
DROP POLICY IF EXISTS "patients_allow_all_update" ON patients;

-- Also drop any other policies that might interfere
DROP POLICY IF EXISTS "patients_update" ON patients;
DROP POLICY IF EXISTS "patients_update_policy" ON patients;

-- ========================================
-- STEP 2: Create a single, comprehensive UPDATE policy
-- ========================================
-- This policy consolidates all role-based logic into one place
-- to avoid PostgreSQL's policy resolution ambiguity

CREATE POLICY "unified_patients_update_policy" ON patients
FOR UPDATE
TO authenticated
USING (
    -- First check: User must be active and approved
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.approval_status = 'approved'
    )
    AND (
        -- Admin can update any patient
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        OR
        -- Nurse can update any patient (including doctor_id assignment)
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'nurse'
        )
        OR
        -- Doctor can update any patient (including doctor_id assignment)
        -- This is the key change - doctors can now reassign patients
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    )
)
WITH CHECK (
    -- Same logic for WITH CHECK to maintain consistency
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.approval_status = 'approved'
    )
    AND (
        -- Admin can update any patient
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        OR
        -- Nurse can update any patient (including doctor_id assignment)
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'nurse'
        )
        OR
        -- Doctor can update any patient (including doctor_id assignment)
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    )
);

-- ========================================
-- STEP 3: Ensure SELECT policies don't conflict
-- ========================================
-- Check and consolidate SELECT policies too

-- Drop potentially conflicting SELECT policies
DROP POLICY IF EXISTS "doctors_view_own_patients" ON patients;
DROP POLICY IF EXISTS "patients_secure_select" ON patients;
DROP POLICY IF EXISTS "view_patients" ON patients;
DROP POLICY IF EXISTS "patients_allow_all_select" ON patients;

-- Create a unified SELECT policy
CREATE POLICY "unified_patients_select_policy" ON patients
FOR SELECT
TO authenticated
USING (
    -- User must be active and approved to see any patients
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.approval_status = 'approved'
    )
    -- All approved users can see all patients
    -- The application layer handles role-based filtering
);

-- ========================================
-- STEP 4: Ensure INSERT policies are consistent
-- ========================================

-- Drop potentially conflicting INSERT policies
DROP POLICY IF EXISTS "patients_secure_insert" ON patients;
DROP POLICY IF EXISTS "insert_patients" ON patients;
DROP POLICY IF EXISTS "patients_allow_all_insert" ON patients;

-- Create a unified INSERT policy
CREATE POLICY "unified_patients_insert_policy" ON patients
FOR INSERT
TO authenticated
WITH CHECK (
    -- User must be active and approved to insert patients
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.approval_status = 'approved'
    )
    AND (
        -- Admin, nurse, or doctor can insert patients
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'nurse', 'doctor')
        )
    )
);

-- ========================================
-- STEP 5: Ensure DELETE policies are consistent
-- ========================================

-- Drop potentially conflicting DELETE policies
DROP POLICY IF EXISTS "patients_secure_delete" ON patients;
DROP POLICY IF EXISTS "delete_patients" ON patients;
DROP POLICY IF EXISTS "patients_allow_all_delete" ON patients;

-- Create a unified DELETE policy (soft deletes via UPDATE)
CREATE POLICY "unified_patients_delete_policy" ON patients
FOR DELETE
TO authenticated
USING (
    -- Only admins can hard delete (though we prefer soft deletes)
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.is_active = true
        AND profiles.approval_status = 'approved'
    )
);

-- ========================================
-- STEP 6: Add helpful comments
-- ========================================

COMMENT ON POLICY "unified_patients_select_policy" ON patients IS
'Allows all active and approved users to view patient records. Role-based filtering is handled at the application layer.';

COMMENT ON POLICY "unified_patients_insert_policy" ON patients IS
'Allows active and approved admin, nurse, and doctor roles to create new patient records.';

COMMENT ON POLICY "unified_patients_update_policy" ON patients IS
'Allows active and approved admin, nurse, and doctor roles to update any patient record, including doctor_id assignment. This consolidates all update permissions into a single policy to avoid conflicts.';

COMMENT ON POLICY "unified_patients_delete_policy" ON patients IS
'Allows only admin users to perform hard deletes. Soft deletes are handled via UPDATE.';

-- ========================================
-- STEP 7: Verify the fix
-- ========================================

-- This query will help verify that we only have one policy per operation
DO $$
DECLARE
    policy_count INTEGER;
    conflicting_policies TEXT;
BEGIN
    -- Check for multiple UPDATE policies
    SELECT COUNT(*), STRING_AGG(policyname, ', ')
    INTO policy_count, conflicting_policies
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'patients'
    AND polcmd = 'UPDATE';

    IF policy_count > 1 THEN
        RAISE WARNING 'Multiple UPDATE policies still exist: %', conflicting_policies;
    ELSE
        RAISE NOTICE 'SUCCESS: Only one UPDATE policy exists';
    END IF;
END $$;

COMMIT;

-- ========================================
-- POST-MIGRATION VERIFICATION
-- ========================================
-- Run these queries after migration to verify the fix:

-- 1. Check that only one UPDATE policy exists:
-- SELECT policyname FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'patients' AND polcmd = 'UPDATE';

-- 2. Test update as a nurse/doctor user:
-- UPDATE patients SET doctor_id = 'some-uuid' WHERE id = 'patient-uuid';

-- 3. Check for any remaining 42P17 errors in logs