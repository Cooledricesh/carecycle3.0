-- Fix TOCTOU race condition in approve_org_request function
-- by adding database-level unique constraint and updating function logic

-- Step 1: Create unique index on LOWER(name) for active organizations
-- This prevents TOCTOU race conditions by enforcing uniqueness at the database level
-- Allows the same name to be reused for inactive organizations
CREATE UNIQUE INDEX IF NOT EXISTS organizations_active_name_unique_idx
ON organizations (LOWER(name))
WHERE is_active = true;

COMMENT ON INDEX organizations_active_name_unique_idx IS
'Ensures unique organization names (case-insensitive) for active organizations only. Prevents TOCTOU race conditions in approve_org_request.';

-- Step 2: Update approve_org_request function to remove application-level duplicate check
-- The database constraint will now handle uniqueness atomically
CREATE OR REPLACE FUNCTION approve_org_request(
  p_request_id uuid,
  p_super_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request organization_requests%ROWTYPE;
  v_new_org_id uuid;
  v_result jsonb;
BEGIN
  -- Verify super admin using parameter (not auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_super_admin_id
      AND role = 'super_admin'
      AND approval_status = 'approved'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin only';
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM organization_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Create organization
  -- Note: Duplicate name check is now enforced by database unique index
  -- (organizations_active_name_unique_idx) to prevent TOCTOU race conditions
  INSERT INTO organizations (name, is_active)
  VALUES (v_request.organization_name, true)
  RETURNING id INTO v_new_org_id;

  -- Update profile (assign organization and role)
  -- Include terms agreement timestamps from organization_requests
  UPDATE profiles
  SET
    organization_id = v_new_org_id,
    role = 'admin',
    approval_status = 'approved',
    approved_by = p_super_admin_id,
    approved_at = now(),
    is_active = true,
    terms_agreed_at = v_request.terms_agreed_at,
    privacy_policy_agreed_at = v_request.privacy_policy_agreed_at
  WHERE id = v_request.requester_user_id;

  -- Update request
  UPDATE organization_requests
  SET
    status = 'approved',
    reviewed_by = p_super_admin_id,
    reviewed_at = now(),
    created_organization_id = v_new_org_id,
    updated_at = now()
  WHERE id = p_request_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'organization_id', v_new_org_id,
    'request_id', p_request_id
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    -- Catch duplicate organization name errors from the unique index
    RAISE EXCEPTION 'Organization name already exists';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to approve request: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION approve_org_request IS 'Superadmin: 신규 기관 등록 요청 승인 (약관 동의 정보 포함, TOCTOU 방지)';
