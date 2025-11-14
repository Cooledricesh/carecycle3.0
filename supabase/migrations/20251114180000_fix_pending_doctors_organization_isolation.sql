-- Fix pending doctors organization isolation
-- Issue: Pending (unregistered) doctors are visible across all organizations
-- Solution: Add organization_id filter to get_pending_doctor_names() function

-- Drop the existing function
DROP FUNCTION IF EXISTS "public"."get_pending_doctor_names"();

-- Recreate with organization isolation
CREATE OR REPLACE FUNCTION "public"."get_pending_doctor_names"()
RETURNS TABLE("name" "text", "patient_count" bigint)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_org_id uuid;
BEGIN
  -- Get the current user's organization_id
  SELECT organization_id INTO current_org_id
  FROM profiles
  WHERE id = auth.uid();

  -- If no organization found, return empty result
  IF current_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.assigned_doctor_name as name,
    COUNT(*) as patient_count
  FROM patients p
  WHERE
    p.assigned_doctor_name IS NOT NULL
    AND p.doctor_id IS NULL
    AND p.organization_id = current_org_id  -- Organization isolation
    AND NOT EXISTS (
      -- Exclude names that match registered doctors in the same organization
      SELECT 1 FROM profiles prof
      WHERE prof.role = 'doctor'
      AND prof.name = p.assigned_doctor_name
      AND prof.organization_id = current_org_id  -- Organization isolation
    )
  GROUP BY p.assigned_doctor_name
  ORDER BY p.assigned_doctor_name;
END;
$$;

-- Set owner
ALTER FUNCTION "public"."get_pending_doctor_names"() OWNER TO "postgres";

-- Grant permissions
GRANT EXECUTE ON FUNCTION "public"."get_pending_doctor_names"() TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_pending_doctor_names"() TO service_role;

-- Add comment
COMMENT ON FUNCTION "public"."get_pending_doctor_names"() IS 'Returns list of pending (unregistered) doctor names with patient counts, filtered by user organization';
