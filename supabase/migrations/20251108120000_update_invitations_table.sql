-- Update invitations table to match requirements
-- This migration adds invited_by column and updates role type

BEGIN;

-- Add invited_by column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.invitations ADD COLUMN invited_by uuid;

    -- Add foreign key constraint to profiles
    ALTER TABLE public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

    COMMENT ON COLUMN public.invitations.invited_by IS '초대를 생성한 사용자 ID';
  END IF;
END $$;

-- Add updated_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.invitations ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;

    -- Create trigger for updated_at
    CREATE OR REPLACE FUNCTION public.handle_invitations_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER set_invitations_updated_at
      BEFORE UPDATE ON public.invitations
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_invitations_updated_at();
  END IF;
END $$;

-- Update role column to use user_role enum if it's still text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'role'
    AND data_type = 'text'
  ) THEN
    -- First update any invalid roles to 'nurse' (default)
    -- Preserve super_admin role
    UPDATE public.invitations
    SET role = 'nurse'
    WHERE role NOT IN ('admin', 'doctor', 'nurse', 'super_admin');

    -- Drop default before changing type
    ALTER TABLE public.invitations ALTER COLUMN role DROP DEFAULT;

    -- Change column type to user_role enum
    ALTER TABLE public.invitations
    ALTER COLUMN role TYPE user_role USING role::user_role;

    -- Set new default
    ALTER TABLE public.invitations ALTER COLUMN role SET DEFAULT 'nurse'::user_role;
  END IF;
END $$;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email);

-- Create index on organization_id for faster filtering
CREATE INDEX IF NOT EXISTS invitations_organization_id_idx ON public.invitations(organization_id);

-- Create index on token for faster token verification
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations(status);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS invitations_org_status_idx ON public.invitations(organization_id, status);

COMMIT;
