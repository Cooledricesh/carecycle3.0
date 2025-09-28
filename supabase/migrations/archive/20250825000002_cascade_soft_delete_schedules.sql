-- Cascade soft delete from patients to schedules
-- When a patient is soft deleted (is_active = false), automatically soft delete all their schedules
-- Date: 2025-08-25

BEGIN;

-- Create function to cascade soft delete to schedules
CREATE OR REPLACE FUNCTION cascade_patient_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if patient is being soft deleted (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        -- Soft delete all active schedules for this patient
        UPDATE schedules
        SET 
            is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE 
            patient_id = NEW.id
            AND is_active = true;
        
        -- Log the cascade action
        RAISE NOTICE 'Cascaded soft delete: Deactivated schedules for patient %', NEW.id;
    END IF;
    
    -- Check if patient is being reactivated (is_active changed from false to true)
    -- Note: We don't automatically reactivate schedules as they might have been 
    -- individually deactivated for other reasons
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on patients table
DROP TRIGGER IF EXISTS trigger_cascade_patient_soft_delete ON patients;

CREATE TRIGGER trigger_cascade_patient_soft_delete
    AFTER UPDATE OF is_active ON patients
    FOR EACH ROW
    EXECUTE FUNCTION cascade_patient_soft_delete();

-- Add comment to explain the trigger
COMMENT ON TRIGGER trigger_cascade_patient_soft_delete ON patients IS 
    'Automatically soft deletes all schedules when a patient is soft deleted';

-- Also add RLS policies for schedules table
-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "view_schedules" ON schedules;
DROP POLICY IF EXISTS "insert_schedules" ON schedules;
DROP POLICY IF EXISTS "update_schedules" ON schedules;
DROP POLICY IF EXISTS "prevent_delete_schedules" ON schedules;

-- Policy for viewing schedules
CREATE POLICY "view_schedules" ON schedules
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for inserting schedules
CREATE POLICY "insert_schedules" ON schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy for updating schedules
CREATE POLICY "update_schedules" ON schedules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Prevent hard delete of schedules (only soft delete allowed)
CREATE POLICY "prevent_delete_schedules" ON schedules
    FOR DELETE
    TO authenticated
    USING (false);

COMMIT;