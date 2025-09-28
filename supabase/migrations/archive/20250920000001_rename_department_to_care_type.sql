-- Migration: Rename department to care_type in profiles table
-- Purpose: Align naming convention between profiles and patients tables for consistency

BEGIN;

-- Step 1: Rename column from department to care_type in profiles table
ALTER TABLE profiles
RENAME COLUMN department TO care_type;

-- Step 2: Update care_type based on role
-- Set nurse users to '낮병원' (day hospital) if care_type is NULL or empty
UPDATE profiles
SET care_type = '낮병원'
WHERE role = 'nurse'
  AND (care_type IS NULL OR care_type = '');

-- Set admin and doctor roles to NULL for consistency
UPDATE profiles
SET care_type = NULL
WHERE role IN ('admin', 'doctor');

-- Step 3: Add CHECK constraint to ensure proper care_type assignment by role
ALTER TABLE profiles
ADD CONSTRAINT check_role_care_type
CHECK (
  (role = 'nurse' AND care_type IN ('외래', '입원', '낮병원'))
  OR
  (role IN ('admin', 'doctor') AND care_type IS NULL)
);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_care_type
ON profiles(role, care_type)
WHERE role = 'nurse';

CREATE INDEX IF NOT EXISTS idx_patients_care_type_active
ON patients(care_type)
WHERE NOT archived;

-- Step 5: Update RLS policies to use care_type instead of department
-- Drop existing policies if they reference department
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Recreate policies with care_type
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.care_type IS 'Care type assignment for nurses (외래/입원/낮병원), NULL for admin/doctor roles';

COMMIT;

-- Rollback script (save for emergency use):
-- BEGIN;
-- ALTER TABLE profiles RENAME COLUMN care_type TO department;
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_nurse_care_type;
-- DROP INDEX IF EXISTS idx_profiles_role_care_type;
-- DROP INDEX IF EXISTS idx_patients_care_type_active;
-- COMMIT;