-- Migration: Allow doctor and nurse roles to update doctor_id in patients table
-- Description: Updates RLS policies to allow doctor and nurse roles to change patient's doctor assignment

BEGIN;

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "doctors_update_own_patients" ON patients;

-- Create new update policy that allows doctor/nurse/admin to update doctor_id
CREATE POLICY "authenticated_users_update_patients" ON patients
FOR UPDATE
TO authenticated
USING (
    -- Allow access for active and approved users
    is_user_active_and_approved()
    AND (
        -- Admin can update all patients
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        -- Nurse can update all patients
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'nurse'
        )
        -- Doctor can update all patients (including changing doctor_id)
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    )
)
WITH CHECK (
    -- Allow updates for active and approved users
    is_user_active_and_approved()
    AND (
        -- Admin can update all fields
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        -- Nurse can update all fields including doctor_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'nurse'
        )
        -- Doctor can update all fields including doctor_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    )
);

-- Add comment for documentation
COMMENT ON POLICY "authenticated_users_update_patients" ON patients IS
'Allows admin, nurse, and doctor roles to update patient records including doctor_id assignment';

COMMIT;