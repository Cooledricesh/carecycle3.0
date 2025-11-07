-- Add is_user_admin() alias for backward compatibility
-- Older migrations use is_user_admin() but newer migration defines is_current_user_admin()
-- This migration creates an alias to maintain compatibility

BEGIN;

-- Create alias function is_user_admin() that calls is_current_user_admin()
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Simply delegate to the properly named function
    RETURN public.is_current_user_admin();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;

COMMENT ON FUNCTION public.is_user_admin() IS
    'Backward compatibility alias for is_current_user_admin().
    Checks if the current authenticated user is an admin with approved status and is active.
    Uses SECURITY DEFINER to bypass RLS policies.';

COMMIT;
