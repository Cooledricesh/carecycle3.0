-- RLS policies for invitations table
-- Admin users can manage invitations for their organization

BEGIN;

-- Enable RLS on invitations table
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "invitations_select_policy" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_policy" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_policy" ON public.invitations;
DROP POLICY IF EXISTS "invitations_delete_policy" ON public.invitations;

-- SELECT: Admin and super_admin can view invitations from their organization
CREATE POLICY "invitations_select_policy"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- INSERT: Admin and super_admin can create invitations for their organization
CREATE POLICY "invitations_insert_policy"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- UPDATE: Admin and super_admin can update invitations from their organization
-- USING: Only allow updating pending invitations (not expired, not already accepted/cancelled)
-- WITH CHECK: Restrict status transitions and updated_at to prevent data manipulation
-- Column-level privileges ensure only status and updated_at can be modified
CREATE POLICY "invitations_update_policy"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  -- Can only update pending invitations from their organization
  invitations.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  -- After update, status must be 'accepted' or 'cancelled'
  invitations.status IN ('accepted', 'cancelled')
  -- Ensure updated_at is not backdated
  AND invitations.updated_at >= (SELECT updated_at FROM public.invitations WHERE id = invitations.id)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Revoke all UPDATE privileges and grant only for specific columns
REVOKE UPDATE ON public.invitations FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.invitations TO authenticated;

-- DELETE: No hard deletes allowed, use soft delete via status update
-- Super admin can delete for emergency cleanup only
CREATE POLICY "invitations_delete_policy"
ON public.invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Add comment explaining the policies
COMMENT ON TABLE public.invitations IS '사용자를 조직에 초대하기 위한 테이블입니다. Admin과 Super Admin만 자신의 조직 초대를 관리할 수 있습니다.';

COMMIT;
