-- Add flexible doctor assignment support
-- This migration allows patients to be assigned to doctors by name even before they register

BEGIN;

-- 1. Add column for text-based doctor assignment
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS assigned_doctor_name text;

-- 2. Add index for performance on doctor name lookups
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor_name
ON patients(assigned_doctor_name)
WHERE assigned_doctor_name IS NOT NULL;

-- 3. Create unified view for patient-doctor assignments
CREATE OR REPLACE VIEW patient_doctor_view AS
SELECT
  p.id,
  p.patient_number,
  p.name as patient_name,
  p.care_type,
  p.is_active,
  p.archived,
  p.created_at,
  p.updated_at,
  p.doctor_id,
  p.assigned_doctor_name,
  -- Unified doctor display name
  COALESCE(
    prof.name,                    -- Registered doctor name
    p.assigned_doctor_name,       -- Unregistered doctor name
    '미지정'                      -- Unassigned
  ) as doctor_display_name,
  -- Assignment status
  CASE
    WHEN p.doctor_id IS NOT NULL THEN 'registered'
    WHEN p.assigned_doctor_name IS NOT NULL THEN 'pending'
    ELSE 'unassigned'
  END as doctor_status,
  -- Include registered doctor details if available
  prof.email as doctor_email,
  prof.role as doctor_role,
  prof.approval_status as doctor_approval_status
FROM patients p
LEFT JOIN profiles prof ON p.doctor_id = prof.id AND prof.role = 'doctor';

-- 4. Create function for auto-linking doctors on signup
CREATE OR REPLACE FUNCTION auto_link_doctor_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process doctor role profiles
  IF NEW.role = 'doctor' AND NEW.name IS NOT NULL THEN
    -- Update patients where assigned_doctor_name matches the new doctor's name
    -- Only update if they don't already have a registered doctor
    UPDATE patients
    SET
      doctor_id = NEW.id,
      assigned_doctor_name = NULL,  -- Clear the text assignment
      updated_at = now()
    WHERE
      assigned_doctor_name = NEW.name
      AND doctor_id IS NULL;

    -- Log the auto-linking for audit
    IF FOUND THEN
      RAISE NOTICE 'Auto-linked % patients to doctor % (%)',
        ROW_COUNT, NEW.name, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for auto-linking
DROP TRIGGER IF EXISTS auto_link_doctor_on_profile_create ON profiles;
CREATE TRIGGER auto_link_doctor_on_profile_create
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_link_doctor_on_signup();

-- 6. Create function to get unique pending doctor names
CREATE OR REPLACE FUNCTION get_pending_doctor_names()
RETURNS TABLE(name text, patient_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.assigned_doctor_name as name,
    COUNT(*) as patient_count
  FROM patients p
  WHERE
    p.assigned_doctor_name IS NOT NULL
    AND p.doctor_id IS NULL
    AND NOT EXISTS (
      -- Exclude names that match registered doctors
      SELECT 1 FROM profiles prof
      WHERE prof.role = 'doctor'
      AND prof.name = p.assigned_doctor_name
    )
  GROUP BY p.assigned_doctor_name
  ORDER BY p.assigned_doctor_name;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant appropriate permissions
GRANT SELECT ON patient_doctor_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_doctor_names() TO authenticated;

-- Add RLS policies for the view (views inherit base table policies)
-- The base patients table already has RLS enabled, so the view will respect those policies

COMMIT;