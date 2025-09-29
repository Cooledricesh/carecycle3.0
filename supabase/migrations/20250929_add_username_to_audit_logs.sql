-- Add user_name column to audit_logs table to properly display usernames
-- This fixes the "알 수 없음" (Unknown) user display issue

BEGIN;

-- Add user_name column to audit_logs table
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Create or replace the audit trigger function to capture user_name
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id uuid;
    audit_user_email text;
    audit_user_name text;
    audit_user_role text;
BEGIN
    -- Get current user information
    audit_user_id := auth.uid();

    -- Fetch user details from profiles table if user is authenticated
    IF audit_user_id IS NOT NULL THEN
        SELECT email, name, role::text
        INTO audit_user_email, audit_user_name, audit_user_role
        FROM public.profiles
        WHERE id = audit_user_id
        LIMIT 1;
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_name,
        user_role,
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE
            WHEN TG_OP = 'DELETE' THEN (OLD.id)::text
            ELSE (NEW.id)::text
        END,
        CASE
            WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
            ELSE NULL
        END,
        audit_user_id,
        audit_user_email,
        audit_user_name,
        audit_user_role,
        NOW()
    );

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing NULL user_name entries by looking up from profiles table
UPDATE public.audit_logs
SET user_name = p.name
FROM public.profiles p
WHERE audit_logs.user_id = p.id
  AND audit_logs.user_name IS NULL
  AND audit_logs.user_id IS NOT NULL;

-- For entries with email but no name, use email prefix as fallback
UPDATE public.audit_logs
SET user_name = split_part(user_email, '@', 1)
WHERE user_name IS NULL
  AND user_email IS NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_name
ON public.audit_logs(user_name);

COMMIT;

-- Add comment for documentation
COMMENT ON COLUMN public.audit_logs.user_name IS 'User display name captured at the time of the action';