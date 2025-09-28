-- ============================================================================
-- Add Bulk Archive Function for Transactional Patient Archiving
-- Date: 2025-09-10
-- Description: Add database function to perform bulk patient archiving in a single transaction
-- ============================================================================

BEGIN;

-- Create a function to bulk archive patients with reason tracking
CREATE OR REPLACE FUNCTION bulk_archive_patients(
    patient_ids uuid[],
    archive_reason text DEFAULT '일괄 아카이브'
)
RETURNS jsonb AS $$
DECLARE
    patient_id uuid;
    processed_count integer := 0;
    current_number text;
    timestamp_suffix text;
    new_archived_number text;
    result jsonb;
BEGIN
    -- Generate timestamp suffix once for the entire batch
    timestamp_suffix := to_char(now(), 'YYYYMMDDHH24MISS');
    
    -- Process each patient in the transaction
    FOREACH patient_id IN ARRAY patient_ids
    LOOP
        -- Get current patient number and verify it's eligible for archiving
        SELECT patient_number INTO current_number 
        FROM patients 
        WHERE id = patient_id 
        AND is_active = false 
        AND archived = false;
        
        -- Skip if patient not found or not eligible
        IF current_number IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Generate unique archived number
        new_archived_number := current_number || '_archived_' || timestamp_suffix || '_' || processed_count;
        
        -- Archive the patient
        UPDATE patients 
        SET 
            archived = true,
            archived_at = now(),
            is_active = false,
            original_patient_number = current_number,
            patient_number = new_archived_number,
            updated_at = now()
        WHERE id = patient_id;
        
        -- Increment processed count
        processed_count := processed_count + 1;
        
        -- Log the archiving (optional: could insert into an archive log table)
        RAISE NOTICE 'Archived patient % with reason: %', current_number, archive_reason;
    END LOOP;
    
    -- Return result summary
    result := jsonb_build_object(
        'processed_count', processed_count,
        'timestamp', now(),
        'reason', archive_reason
    );
    
    RETURN result;
EXCEPTION
    WHEN others THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Bulk archive failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on new function
GRANT EXECUTE ON FUNCTION bulk_archive_patients(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_archive_patients(uuid[], text) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_archive_patients(uuid[], text) IS 'Archives multiple patients in a single transaction with custom reason';

COMMIT;