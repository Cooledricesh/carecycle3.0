-- Fix critical RLS policy for user profile creation during signup
-- This resolves the chicken-and-egg problem where new users couldn't create profiles
-- because the existing INSERT policy only allowed admins to insert profiles

BEGIN;

-- Add RLS policy to allow users to create their own profile during signup
-- This works in conjunction with the handle_new_user() trigger function
CREATE POLICY IF NOT EXISTS "Users can create own profile during signup" 
ON public.profiles 
FOR INSERT 
TO public
WITH CHECK (auth.uid() = id);

-- Verify the policy was created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can create own profile during signup'
        AND cmd = 'INSERT'
    ) THEN
        RAISE EXCEPTION 'Failed to create RLS policy for profile creation';
    END IF;
    
    RAISE NOTICE 'Successfully created RLS policy: Users can create own profile during signup';
END $$;

COMMIT;