-- Migration: Create direct user deletion function with triggers disabled
-- Bug: BUG-2025-11-12-USER-DELETE-TRIGGER-FIX
-- Purpose: Delete users via SQL while disabling triggers to prevent notification INSERT errors

CREATE OR REPLACE FUNCTION public.direct_delete_user_no_triggers(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_result json;
BEGIN
  -- Disable all triggers temporarily to prevent notification INSERT during CASCADE
  SET session_replication_role = replica;

  -- 1. Delete from auth schema tables first (in correct order)
  -- All use UUID except refresh_tokens which uses VARCHAR
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
  DELETE FROM auth.one_time_tokens WHERE user_id = p_user_id;
  DELETE FROM auth.flow_state WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.oauth_authorizations WHERE user_id = p_user_id;
  DELETE FROM auth.oauth_consents WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text; -- VARCHAR type

  -- 2. Delete notifications FIRST (before profiles CASCADE)
  DELETE FROM public.notifications WHERE recipient_id = p_user_id;

  -- 3. Delete from public schema (profiles CASCADE will trigger)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 4. Delete from auth.users (should work now)
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Re-enable triggers
  SET session_replication_role = DEFAULT;

  v_result := json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User deleted (triggers disabled)'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Re-enable triggers on error
    SET session_replication_role = DEFAULT;
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', p_user_id
    );
END;
$$;
