-- Migration: Fix audit_logs.user_id foreign key constraint
-- BUG-2025-003-USER-DELETE-500: Add ON DELETE SET NULL to allow user deletion
-- Created: 2025-11-12
--
-- Problem: audit_logs.user_id references auth.users without CASCADE option,
--          causing foreign key violation when deleting users.
--
-- Solution: Drop existing constraint and recreate with ON DELETE SET NULL
--           to preserve audit logs while allowing user deletion.

BEGIN;

-- Step 1: Drop existing foreign key constraint
-- This constraint was created without ON DELETE option, defaulting to NO ACTION
ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Step 2: Recreate constraint with ON DELETE SET NULL
-- When a user is deleted from auth.users, audit_logs.user_id will be set to NULL
-- This preserves audit history while allowing user deletion
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- Step 3: Add comment for documentation
COMMENT ON CONSTRAINT audit_logs_user_id_fkey ON public.audit_logs IS
'Foreign key to auth.users with ON DELETE SET NULL to preserve audit logs after user deletion';

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
-- ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
-- FOREIGN KEY (user_id) REFERENCES auth.users(id);
