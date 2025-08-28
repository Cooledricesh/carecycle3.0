-- Fix cascade delete for patient_schedules table
-- Handle both schedules and patient_schedules tables
-- Date: 2025-08-28

BEGIN;

-- First, add patient_id column to patient_schedules if it doesn't exist
-- This will link patient_schedules to patients table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patient_schedules' 
        AND column_name = 'patient_id'
    ) THEN
        ALTER TABLE patient_schedules 
        ADD COLUMN patient_id UUID REFERENCES patients(id);
        
        -- Try to populate patient_id based on patient_name match
        UPDATE patient_schedules ps
        SET patient_id = p.id
        FROM patients p
        WHERE ps.patient_name = p.name
        AND p.is_active = true;
    END IF;
END $$;

-- Drop and recreate the trigger function to handle both tables
DROP TRIGGER IF EXISTS trigger_cascade_patient_soft_delete ON patients;
DROP FUNCTION IF EXISTS cascade_patient_soft_delete();

-- Create improved function that handles both schedules and patient_schedules tables
CREATE OR REPLACE FUNCTION cascade_patient_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    affected_schedules INTEGER := 0;
    affected_patient_schedules INTEGER := 0;
    patient_name_var TEXT;
BEGIN
    -- Validate inputs
    IF NEW.id IS NULL THEN
        RAISE WARNING 'Attempted to process null patient ID';
        RETURN NEW;
    END IF;
    
    -- Get patient name for patient_schedules table
    SELECT name INTO patient_name_var FROM patients WHERE id = NEW.id;
    
    -- Check if patient is being soft deleted (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        BEGIN
            -- Handle schedules table (if it exists and has data)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedules') THEN
                -- Soft delete schedules by changing status to 'deleted'
                UPDATE schedules 
                SET 
                    status = 'deleted',
                    updated_at = CURRENT_TIMESTAMP
                WHERE 
                    patient_id = NEW.id 
                    AND status IN ('active', 'paused');
                
                GET DIAGNOSTICS affected_schedules = ROW_COUNT;
            END IF;
            
            -- Handle patient_schedules table 
            -- Delete by patient_id if available, otherwise by patient_name
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'patient_schedules' 
                AND column_name = 'patient_id'
            ) THEN
                -- Delete using patient_id
                DELETE FROM patient_schedules
                WHERE patient_id = NEW.id;
            ELSE
                -- Fallback: Delete using patient_name
                DELETE FROM patient_schedules
                WHERE patient_name = patient_name_var;
            END IF;
            
            GET DIAGNOSTICS affected_patient_schedules = ROW_COUNT;
            
            -- Log the cascade action with timestamp
            RAISE NOTICE '[%] Cascaded deletion: Deleted % patient_schedules and soft-deleted % schedules for patient % (%)', 
                CURRENT_TIMESTAMP, affected_patient_schedules, affected_schedules, NEW.id, patient_name_var;
                
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                RAISE WARNING 'Failed to cascade delete schedules for patient %: %', 
                    NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on patients table with condition
CREATE TRIGGER trigger_cascade_patient_soft_delete
    AFTER UPDATE OF is_active ON patients
    FOR EACH ROW
    WHEN (OLD.is_active = true AND NEW.is_active = false)
    EXECUTE FUNCTION cascade_patient_soft_delete();

-- Add documentation
COMMENT ON FUNCTION cascade_patient_soft_delete() IS 
    'Cascades patient soft deletion to both schedules and patient_schedules tables. Deletes from patient_schedules and soft-deletes from schedules.';
    
COMMENT ON TRIGGER trigger_cascade_patient_soft_delete ON patients IS 
    'Automatically removes all schedules when a patient is soft deleted';

COMMIT;