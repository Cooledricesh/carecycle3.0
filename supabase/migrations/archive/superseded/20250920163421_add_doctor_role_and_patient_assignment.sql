-- Migration: Add doctor role and patient-doctor relationship
-- Description: Adds doctor role to user_role enum, adds doctor_id to patients table,
--              and sets up initial doctor assignments

BEGIN;

-- 1. Add 'doctor' value to user_role ENUM
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in some PostgreSQL versions
-- We'll handle this with a conditional check
DO $$
BEGIN
    -- Check if 'doctor' value already exists in the enum
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'doctor'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'user_role'
        )
    ) THEN
        -- Add the new value
        ALTER TYPE user_role ADD VALUE 'doctor' AFTER 'admin';
    END IF;
END $$;

COMMIT;

-- Start a new transaction for the remaining operations
BEGIN;

-- 2. Add doctor_id column to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_care_type_doctor ON patients(care_type, doctor_id);

-- 4. Update coolrice86@naver.com user role from 'nurse' to 'doctor'
UPDATE profiles
SET
    role = 'doctor',
    updated_at = NOW()
WHERE email = 'coolrice86@naver.com';

-- 5. Assign all existing patients to the doctor (coolrice86@naver.com)
-- Using the user's ID directly for safety
UPDATE patients
SET
    doctor_id = 'c99b28ec-32eb-40fa-be8c-896596db952f',
    updated_at = NOW()
WHERE doctor_id IS NULL;

-- 6. Add RLS policy for doctors to view only their assigned patients
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "doctors_view_own_patients" ON patients;

-- Create new policy
CREATE POLICY "doctors_view_own_patients" ON patients
FOR SELECT
USING (
    -- Allow if user is the assigned doctor
    doctor_id = auth.uid()
    OR
    -- Allow if user is nurse or admin (they can see all patients)
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('nurse', 'admin')
    )
);

-- 7. Add policy for doctors to update only their assigned patients
DROP POLICY IF EXISTS "doctors_update_own_patients" ON patients;

CREATE POLICY "doctors_update_own_patients" ON patients
FOR UPDATE
USING (
    -- Allow if user is the assigned doctor
    doctor_id = auth.uid()
    OR
    -- Allow if user is nurse or admin
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('nurse', 'admin')
    )
)
WITH CHECK (
    -- For doctors, ensure they can't change the doctor_id
    (
        doctor_id = auth.uid()
        AND doctor_id = (SELECT doctor_id FROM patients WHERE id = patients.id)
    )
    OR
    -- Nurses and admins can change anything
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('nurse', 'admin')
    )
);

-- 8. Grant necessary permissions
GRANT SELECT, UPDATE ON patients TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- 9. Add comment for documentation
COMMENT ON COLUMN patients.doctor_id IS 'ID of the doctor assigned to this patient. References profiles table.';

COMMIT;

-- Verification queries (commented out, for manual testing)
-- SELECT COUNT(*) as doctor_count FROM profiles WHERE role = 'doctor';
-- SELECT COUNT(*) as assigned_patients FROM patients WHERE doctor_id IS NOT NULL;
-- SELECT id, email, name, role FROM profiles WHERE email = 'coolrice86@naver.com';