-- Fix ROW_COUNT usage in cascade soft delete trigger
-- The previous migration incorrectly used ROW_COUNT directly
-- This fixes it to use GET DIAGNOSTICS properly
-- Date: 2025-08-26

BEGIN;

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS trigger_cascade_patient_soft_delete ON patients;
DROP FUNCTION IF EXISTS cascade_patient_soft_delete();

-- Create corrected function with proper row count handling
CREATE OR REPLACE FUNCTION cascade_patient_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Check if patient is being soft deleted (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        -- Pause all active schedules for this patient
        UPDATE schedules
        SET 
            status = 'paused',
            updated_at = CURRENT_TIMESTAMP
        WHERE 
            patient_id = NEW.id
            AND status = 'active';
        
        -- Get the number of affected rows properly
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        -- Log the cascade action
        RAISE NOTICE 'Cascaded soft delete: Paused % schedules for patient %', affected_rows, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on patients table
CREATE TRIGGER trigger_cascade_patient_soft_delete
    AFTER UPDATE OF is_active ON patients
    FOR EACH ROW
    EXECUTE FUNCTION cascade_patient_soft_delete();

-- Add comment to explain the trigger
COMMENT ON TRIGGER trigger_cascade_patient_soft_delete ON patients IS 
    'Automatically pauses all active schedules when a patient is soft deleted';

COMMIT;