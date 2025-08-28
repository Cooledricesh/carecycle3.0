-- Cascade delete patient schedules when patient is soft deleted
-- Soft deletes schedules to maintain data recovery capability
-- Date: 2025-08-28

BEGIN;

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_cascade_patient_soft_delete ON patients;
DROP FUNCTION IF EXISTS cascade_patient_soft_delete();

-- Create improved function with soft delete and error handling
CREATE OR REPLACE FUNCTION cascade_patient_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    affected_rows INTEGER := 0;
BEGIN
    -- Validate inputs
    IF NEW.id IS NULL THEN
        RAISE WARNING 'Attempted to process null patient ID';
        RETURN NEW;
    END IF;
    
    -- Check if patient is being soft deleted (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        BEGIN
            -- Soft delete schedules by changing status to 'deleted'
            -- This allows data recovery if needed
            UPDATE schedules 
            SET 
                status = 'deleted',
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                patient_id = NEW.id 
                AND status IN ('active', 'paused');
            
            -- Get the number of affected rows
            GET DIAGNOSTICS affected_rows = ROW_COUNT;
            
            -- Log the cascade action with timestamp
            RAISE NOTICE '[%] Cascaded soft deletion: Changed % schedules to deleted status for patient %', 
                CURRENT_TIMESTAMP, affected_rows, NEW.id;
                
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                RAISE WARNING 'Failed to cascade delete schedules for patient %: %', 
                    NEW.id, SQLERRM;
                -- Continue with patient update even if schedule update fails
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
    'Cascades patient soft deletion to associated schedules. Changes schedule status to deleted when patient is deactivated. Maintains data for potential recovery.';
    
COMMENT ON TRIGGER trigger_cascade_patient_soft_delete ON patients IS 
    'Automatically soft deletes all active/paused schedules when a patient is soft deleted';

-- Add status value if not exists (for backward compatibility)
DO $$ 
BEGIN
    -- Check if 'deleted' exists in schedule_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'deleted' 
        AND enumtypid = 'schedule_status'::regtype
    ) THEN
        ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'deleted' AFTER 'completed';
    END IF;
END $$;

COMMIT;