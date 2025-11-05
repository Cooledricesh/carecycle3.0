-- ============================================================================
-- Add Patient Archiving Support for Restoration System
-- Date: 2025-09-09
-- Description: Enable patient restoration by adding archiving fields and modifying unique constraints
-- ============================================================================

BEGIN;

-- Add new columns to support archiving
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS original_patient_number text NULL;

-- Drop the existing unique constraint on patient_number
ALTER TABLE patients DROP CONSTRAINT IF EXISTS unique_patient_number;

-- Create a new composite unique constraint that allows inactive patients to coexist
-- This prevents conflicts when:
-- 1. An active patient exists with patient_number 'P001'
-- 2. An archived patient exists with patient_number 'P001_archived_20250909123456'
-- 3. A new patient can be created with patient_number 'P001'
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_patient_number 
ON patients (patient_number) 
WHERE (is_active = true AND archived = false);

-- Create index for archived patients lookup
CREATE INDEX IF NOT EXISTS idx_patients_archived ON patients(archived, archived_at);
CREATE INDEX IF NOT EXISTS idx_patients_original_number ON patients(original_patient_number);

-- Create a function to archive patient with timestamp suffix
CREATE OR REPLACE FUNCTION archive_patient_with_timestamp(patient_id uuid)
RETURNS void AS $$
DECLARE
    current_number text;
    timestamp_suffix text;
    new_archived_number text;
BEGIN
    -- Get current patient number
    SELECT patient_number INTO current_number 
    FROM patients 
    WHERE id = patient_id;
    
    -- Generate timestamp suffix
    timestamp_suffix := to_char(now(), 'YYYYMMDDHH24MISS');
    new_archived_number := current_number || '_archived_' || timestamp_suffix;
    
    -- Update patient record
    UPDATE patients 
    SET 
        archived = true,
        archived_at = now(),
        is_active = false,
        original_patient_number = current_number,
        patient_number = new_archived_number,
        updated_at = now()
    WHERE id = patient_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to restore archived patient
CREATE OR REPLACE FUNCTION restore_archived_patient(patient_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE patients 
    SET 
        archived = false,
        archived_at = NULL,
        is_active = true,
        patient_number = original_patient_number,
        original_patient_number = NULL,
        updated_at = now()
    WHERE id = patient_id AND archived = true;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to handle archived patients
-- Allow viewing archived patients for restoration purposes
DROP POLICY IF EXISTS "Authenticated users can view archived patients for restoration" ON patients;
CREATE POLICY "Authenticated users can view archived patients for restoration" ON patients
    FOR SELECT
    TO authenticated
    USING (archived = true);

-- Restrict patient updates to archiving operations only
-- This policy prevents unauthorized modification of core patient data while allowing archiving functions
DROP POLICY IF EXISTS "patients_allow_all_update" ON patients;

CREATE POLICY "Allow archiving operations only" ON patients
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (
        -- Only allow changes if this is part of an archiving/restoration operation
        -- Core patient data cannot be modified, only archiving-related fields
        name = (SELECT name FROM patients p WHERE p.id = patients.id) AND
        care_type = (SELECT care_type FROM patients p WHERE p.id = patients.id) AND
        metadata = (SELECT metadata FROM patients p WHERE p.id = patients.id) AND
        created_by = (SELECT created_by FROM patients p WHERE p.id = patients.id) AND
        created_at = (SELECT created_at FROM patients p WHERE p.id = patients.id)
        -- Allow changes to: patient_number, is_active, archived, archived_at, original_patient_number, updated_at
    );

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION archive_patient_with_timestamp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_archived_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_patient_with_timestamp(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION restore_archived_patient(uuid) TO service_role;

-- Add comment for documentation
COMMENT ON COLUMN patients.archived IS 'Indicates if patient has been archived to resolve unique constraint conflicts';
COMMENT ON COLUMN patients.archived_at IS 'Timestamp when patient was archived';
COMMENT ON COLUMN patients.original_patient_number IS 'Original patient number before archiving (for restoration)';
COMMENT ON FUNCTION archive_patient_with_timestamp(uuid) IS 'Archives a patient by setting archived=true and appending timestamp to patient_number';
COMMENT ON FUNCTION restore_archived_patient(uuid) IS 'Restores an archived patient by reverting to original patient number';

COMMIT;