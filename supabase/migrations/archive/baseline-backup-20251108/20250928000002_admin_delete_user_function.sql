-- Migration: Admin Delete User Function
-- Purpose: Atomic transaction for safe user deletion with audit trail preservation
-- Date: 2025-09-28

-- Create function for atomic user deletion
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_user_id uuid,
  p_target_role text,
  p_remaining_admins integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role text;
BEGIN
  -- Try to get role from profiles (may be NULL if already CASCADE deleted)
  SELECT role INTO v_target_role
  FROM profiles
  WHERE id = p_user_id;

  -- If profile already deleted, use the passed parameter
  IF v_target_role IS NULL THEN
    v_target_role := p_target_role;
  END IF;

  -- Prevent deleting the last admin using pre-calculated count
  IF v_target_role = 'admin' THEN
    IF p_remaining_admins <= 0 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin';
    END IF;
  END IF;

  -- Begin transaction (implicit in function)

  -- 1. Anonymize audit logs instead of deleting (compliance requirement)
  UPDATE audit_logs
  SET
    user_id = NULL,
    user_email = 'deleted-user@system.local',
    user_name = 'Deleted User'
  WHERE user_id = p_user_id;

  -- 2. Delete notification records (not audit-critical)
  DELETE FROM notifications WHERE recipient_id = p_user_id;

  -- 3. Delete schedule logs (not audit-critical)
  DELETE FROM schedule_logs WHERE changed_by = p_user_id;

  -- 4. Delete user preferences
  DELETE FROM user_preferences WHERE user_id = p_user_id;

  -- 5. Delete query performance logs
  DELETE FROM query_performance_log WHERE user_id = p_user_id;

  -- 6. Nullify foreign key references in schedules and related tables
  UPDATE schedule_executions
  SET executed_by = NULL
  WHERE executed_by = p_user_id;

  UPDATE schedule_executions
  SET doctor_id_at_completion = NULL
  WHERE doctor_id_at_completion = p_user_id;

  UPDATE schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE schedules
  SET assigned_nurse_id = NULL
  WHERE assigned_nurse_id = p_user_id;

  UPDATE patients
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE patients
  SET doctor_id = NULL
  WHERE doctor_id = p_user_id;

  UPDATE patient_schedules
  SET nurse_id = NULL
  WHERE nurse_id = p_user_id;

  UPDATE patient_schedules
  SET created_by = NULL
  WHERE created_by = p_user_id;

  UPDATE profiles
  SET approved_by = NULL
  WHERE approved_by = p_user_id;

  -- Return summary of operation
  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User data cleaned up successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to delete user data: %', SQLERRM;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid, text, integer) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION admin_delete_user(uuid, text, integer) IS
  'Atomically deletes user data with audit trail preservation. Prevents deletion of last admin. Must be called by service role. Accepts pre-calculated role and admin count to handle CASCADE deletion.';