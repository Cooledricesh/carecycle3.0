-- ============================================================================
-- Migration: Create organization_policies table
-- Created: 2025-11-09
-- Purpose: Store organization-specific policies (e.g., auto-hold settings)
-- Phase: 2.2.1 - Organization Policies
-- ============================================================================

-- STEP 1: Create organization_policies table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organization_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    auto_hold_overdue_days INTEGER CHECK (auto_hold_overdue_days IS NULL OR auto_hold_overdue_days >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add table comments
COMMENT ON TABLE public.organization_policies IS '기관별 정책 설정 (자동 보류, 알림 설정 등)';
COMMENT ON COLUMN public.organization_policies.organization_id IS '정책이 적용될 기관 ID (1:1 관계)';
COMMENT ON COLUMN public.organization_policies.auto_hold_overdue_days IS '자동 보류 기준 일수. NULL이면 자동 보류 비활성화, 숫자면 해당 일수 초과 시 자동 보류';

-- STEP 2: Create indexes
-- ============================================================================

-- Index for organization_id lookups (though it's already unique)
CREATE INDEX idx_organization_policies_organization_id
ON public.organization_policies(organization_id);

-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.organization_policies ENABLE ROW LEVEL SECURITY;

-- STEP 4: RLS Policies
-- ============================================================================

-- Policy 1: Super Admin can view all policies
CREATE POLICY "super_admin_select_all_policies"
ON public.organization_policies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
);

-- Policy 2: Users can view their organization's policy
CREATE POLICY "users_select_own_org_policy"
ON public.organization_policies
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT profiles.organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
    )
);

-- Policy 3: Only admins can insert policies for their organization
CREATE POLICY "admin_insert_policy"
ON public.organization_policies
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT profiles.organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- Policy 4: Only admins can update their organization's policy
CREATE POLICY "admin_update_policy"
ON public.organization_policies
FOR UPDATE
TO authenticated
USING (
    organization_id IN (
        SELECT profiles.organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- Policy 5: Only admins can delete their organization's policy
CREATE POLICY "admin_delete_policy"
ON public.organization_policies
FOR DELETE
TO authenticated
USING (
    organization_id IN (
        SELECT profiles.organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- STEP 5: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER set_organization_policies_updated_at
BEFORE UPDATE ON public.organization_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE: organization_policies table created
-- ============================================================================
-- Next Steps:
-- - Phase 2.2.2: Implement UI/API for policy settings
-- - Phase 2.2.3: Implement auto-hold Edge Function
-- ============================================================================
