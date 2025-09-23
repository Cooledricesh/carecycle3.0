-- Migration: Add admin functions for updating user profiles
-- Description: Adds secure functions for admins to update user roles and care types

BEGIN;

-- 1. Create function to update user role (admin only)
CREATE OR REPLACE FUNCTION update_user_role(
    target_user_id UUID,
    new_role user_role
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_role user_role;
    updated_user JSON;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user roles';
    END IF;

    -- Prevent self role change for safety
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot change your own role';
    END IF;

    -- Update the target user's role
    UPDATE profiles
    SET
        role = new_role,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'role', role,
        'care_type', care_type
    ) INTO updated_user;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN updated_user;
END;
$$;

-- 2. Create function to update user care_type (admin only)
CREATE OR REPLACE FUNCTION update_user_care_type(
    target_user_id UUID,
    new_care_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_role user_role;
    updated_user JSON;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user departments';
    END IF;

    -- Update the target user's care_type
    UPDATE profiles
    SET
        care_type = new_care_type,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'role', role,
        'care_type', care_type
    ) INTO updated_user;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN updated_user;
END;
$$;

-- 3. Create combined function to update both role and care_type
CREATE OR REPLACE FUNCTION update_user_profile_admin(
    target_user_id UUID,
    new_role user_role DEFAULT NULL,
    new_care_type TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_role user_role;
    updated_user JSON;
    update_query TEXT;
BEGIN
    -- Check if the current user is an admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();

    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can update user profiles';
    END IF;

    -- Prevent self role change for safety
    IF target_user_id = auth.uid() AND new_role IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot change your own role';
    END IF;

    -- Build dynamic update query
    update_query := 'UPDATE profiles SET updated_at = NOW()';

    IF new_role IS NOT NULL THEN
        update_query := update_query || ', role = $2';
    END IF;

    IF new_care_type IS NOT NULL THEN
        update_query := update_query || ', care_type = $3';
    END IF;

    update_query := update_query || ' WHERE id = $1 RETURNING json_build_object(
        ''id'', id,
        ''name'', name,
        ''email'', email,
        ''role'', role,
        ''care_type'', care_type,
        ''is_active'', is_active,
        ''approval_status'', approval_status
    )';

    -- Execute the update
    IF new_role IS NOT NULL AND new_care_type IS NOT NULL THEN
        EXECUTE update_query USING target_user_id, new_role, new_care_type INTO updated_user;
    ELSIF new_role IS NOT NULL THEN
        UPDATE profiles
        SET role = new_role, updated_at = NOW()
        WHERE id = target_user_id
        RETURNING json_build_object(
            'id', id,
            'name', name,
            'email', email,
            'role', role,
            'care_type', care_type,
            'is_active', is_active,
            'approval_status', approval_status
        ) INTO updated_user;
    ELSIF new_care_type IS NOT NULL THEN
        UPDATE profiles
        SET care_type = new_care_type, updated_at = NOW()
        WHERE id = target_user_id
        RETURNING json_build_object(
            'id', id,
            'name', name,
            'email', email,
            'role', role,
            'care_type', care_type,
            'is_active', is_active,
            'approval_status', approval_status
        ) INTO updated_user;
    END IF;

    IF updated_user IS NULL THEN
        RAISE EXCEPTION 'User not found or no changes made';
    END IF;

    RETURN updated_user;
END;
$$;

-- 4. Add RLS policy for profiles table to allow admins to update other users
DROP POLICY IF EXISTS "admins_update_all_profiles" ON profiles;

CREATE POLICY "admins_update_all_profiles" ON profiles
FOR UPDATE
USING (
    -- Allow admins to update any profile except changing their own role
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    -- Ensure admins cannot change their own role
    (id != auth.uid()) OR (role = (SELECT role FROM profiles WHERE id = auth.uid()))
);

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_care_type TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile_admin TO authenticated;

-- 6. Add helpful comments
COMMENT ON FUNCTION update_user_role IS 'Admin-only function to update a user''s role';
COMMENT ON FUNCTION update_user_care_type IS 'Admin-only function to update a user''s department (care_type)';
COMMENT ON FUNCTION update_user_profile_admin IS 'Admin-only function to update user profile including role and care_type';

COMMIT;