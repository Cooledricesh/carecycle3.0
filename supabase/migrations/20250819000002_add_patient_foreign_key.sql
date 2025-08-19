-- ============================================================================
-- Add missing foreign key constraint for patient_id in schedules table
-- Date: 2025-08-19
-- Description: Adds foreign key relationship between schedules.patient_id and patients.id
-- ============================================================================

BEGIN;

-- Add foreign key constraint for patient_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'schedules_patient_id_fkey'
        AND table_name = 'schedules'
    ) THEN
        ALTER TABLE schedules
        ADD CONSTRAINT schedules_patient_id_fkey
        FOREIGN KEY (patient_id) 
        REFERENCES patients(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint schedules_patient_id_fkey added successfully';
    ELSE
        RAISE NOTICE 'Foreign key constraint schedules_patient_id_fkey already exists';
    END IF;
END $$;

-- Create index on patient_id for better query performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_schedules_patient_id ON schedules(patient_id);

COMMIT;