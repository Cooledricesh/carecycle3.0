-- ============================================================================
-- Add Atomic Patient Restore Function
-- Date: 2025-09-10
-- Description: Create atomic restore function that handles both restoration and optional updates
-- ============================================================================

BEGIN;

-- Drop the old restore function to replace it with the atomic version
DROP FUNCTION IF EXISTS restore_archived_patient(uuid);

-- Create atomic restore function that handles both restoration and optional updates
CREATE OR REPLACE FUNCTION restore_patient_atomic(
    patient_id uuid,
    update_name text DEFAULT NULL,
    update_care_type text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    patient_number text,
    name text,
    care_type text,
    is_active boolean,
    archived boolean,
    archived_at timestamptz,
    original_patient_number text,
    metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz
) AS $$
DECLARE
    current_patient_record RECORD;
    is_archived boolean;
    original_number text;
BEGIN
    -- Get current patient info to determine restoration strategy
    SELECT * INTO current_patient_record
    FROM patients 
    WHERE patients.id = patient_id;
    
    -- Check if patient exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient with ID % not found', patient_id;
    END IF;
    
    -- Store current archived status and original number
    is_archived := current_patient_record.archived;
    original_number := current_patient_record.original_patient_number;
    
    -- Perform atomic restore and update operation
    IF is_archived THEN
        -- Restore archived patient and apply optional updates
        UPDATE patients 
        SET 
            archived = false,
            archived_at = NULL,
            is_active = true,
            patient_number = COALESCE(original_number, patients.patient_number),
            original_patient_number = NULL,
            name = COALESCE(update_name, patients.name),
            care_type = COALESCE(update_care_type, patients.care_type),
            updated_at = now()
        WHERE patients.id = patient_id;
    ELSE
        -- Just reactivate soft-deleted patient and apply optional updates
        UPDATE patients 
        SET 
            is_active = true,
            name = COALESCE(update_name, patients.name),
            care_type = COALESCE(update_care_type, patients.care_type),
            updated_at = now()
        WHERE patients.id = patient_id;
    END IF;
    
    -- Return the updated patient record
    RETURN QUERY
    SELECT 
        p.id,
        p.patient_number,
        p.name,
        p.care_type,
        p.is_active,
        p.archived,
        p.archived_at,
        p.original_patient_number,
        p.metadata,
        p.created_at,
        p.updated_at
    FROM patients p
    WHERE p.id = patient_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on the new atomic function
GRANT EXECUTE ON FUNCTION restore_patient_atomic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_patient_atomic(uuid, text, text) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION restore_patient_atomic(uuid, text, text) IS 'Atomically restores a patient and applies optional updates in a single transaction';

COMMIT;