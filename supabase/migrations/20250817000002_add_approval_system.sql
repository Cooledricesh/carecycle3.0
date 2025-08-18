-- Add approval system to profiles table
-- This migration adds approval workflow for new user registrations

BEGIN;

-- Add approval status enum
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Add approval fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);

-- Create a function to check if a user is an admin
-- This avoids RLS recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
BEGIN
    -- Direct query without RLS
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN user_role = 'admin';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user is approved
CREATE OR REPLACE FUNCTION public.is_approved(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_status approval_status;
BEGIN
    SELECT approval_status INTO user_status
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN user_status = 'approved';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger function to set pending status for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if profile already exists (in case of admin creation)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        RETURN new;
    END IF;
    
    -- Create profile with pending status for new users
    INSERT INTO public.profiles (
        id, 
        email, 
        name, 
        role,
        approval_status,
        is_active
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'nurse'::user_role),
        CASE 
            WHEN (new.raw_user_meta_data->>'role')::text = 'admin' THEN 'approved'::approval_status
            ELSE 'pending'::approval_status
        END,
        FALSE -- Inactive until approved
    );
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing admin account to approved status
UPDATE public.profiles 
SET approval_status = 'approved', 
    is_active = true
WHERE email = 'cooldericesh@gmail.com';

-- Drop all existing RLS policies to recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile during signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Create new RLS policies with approval system

-- SELECT policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin(auth.uid()));

-- INSERT policies
CREATE POLICY "Users can create own profile during signup" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id 
        AND approval_status = 'pending'
    );

CREATE POLICY "Admins can insert any profile" ON public.profiles
    FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE policies  
CREATE POLICY "Approved users can update own basic info" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id 
        AND public.is_approved(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id 
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND approval_status = (SELECT approval_status FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- DELETE policies
CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE USING (public.is_admin(auth.uid()));

-- Create function to approve a user
CREATE OR REPLACE FUNCTION public.approve_user(
    target_user_id UUID,
    approver_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if approver is admin
    IF NOT public.is_admin(approver_id) THEN
        RAISE EXCEPTION 'Only admins can approve users';
    END IF;
    
    -- Update the user's approval status
    UPDATE public.profiles
    SET 
        approval_status = 'approved',
        approved_by = approver_id,
        approved_at = NOW(),
        is_active = true
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reject a user
CREATE OR REPLACE FUNCTION public.reject_user(
    target_user_id UUID,
    reason TEXT,
    rejector_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if rejector is admin
    IF NOT public.is_admin(rejector_id) THEN
        RAISE EXCEPTION 'Only admins can reject users';
    END IF;
    
    -- Update the user's approval status
    UPDATE public.profiles
    SET 
        approval_status = 'rejected',
        approved_by = rejector_id,
        approved_at = NOW(),
        rejection_reason = reason,
        is_active = false
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;