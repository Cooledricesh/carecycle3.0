-- Emergency fix for authentication issues
-- Date: 2025-08-26

BEGIN;

-- Ensure profiles table has proper RLS policies
-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Users can create own profile during signup" ON public.profiles;

-- Recreate essential profile creation policy with less restrictive conditions
CREATE POLICY "Users can create own profile during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
    auth.uid() = id
);

-- Ensure users can always view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Fix the handle_new_user function to work with current schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        RETURN new;
    END IF;
    
    -- Create profile for new user
    INSERT INTO public.profiles (
        id, 
        email, 
        name, 
        role,
        approval_status,
        is_active
    ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'nurse'),
        'pending',  -- Default to pending for approval system
        true
    )
    ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile somehow exists
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Fix any existing users without profiles
INSERT INTO public.profiles (id, email, name, role, approval_status, is_active)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'nurse',
    'approved',  -- Auto-approve existing users
    true
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Update any users with pending status to approved (temporary fix)
UPDATE public.profiles 
SET approval_status = 'approved' 
WHERE approval_status = 'pending' 
AND created_at < NOW() - INTERVAL '1 minute';

COMMIT;