-- ============================================================================
-- Migration: Create departments table
-- Created: 2025-11-09
-- Purpose: Normalize care_type from TEXT to departments table with FK
-- Phase: 2.1.1 - Schema Design
-- ============================================================================

-- STEP 1: Create departments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Unique constraint: prevent duplicate department names within same organization
    CONSTRAINT unique_org_department_name UNIQUE (organization_id, name)
);

-- Add table comment
COMMENT ON TABLE public.departments IS '기관별 소속(부서) 정보. care_type을 정규화한 테이블.';
COMMENT ON COLUMN public.departments.name IS '소속명 (예: 외래, 입원, 낮병원)';
COMMENT ON COLUMN public.departments.organization_id IS '소속하는 기관 ID';
COMMENT ON COLUMN public.departments.description IS '소속에 대한 추가 설명';
COMMENT ON COLUMN public.departments.display_order IS '정렬 순서 (작은 숫자가 먼저 표시됨)';
COMMENT ON COLUMN public.departments.is_active IS '활성 상태 (비활성화된 소속은 UI에서 숨김)';

-- STEP 2: Create indexes for performance
-- ============================================================================

-- Index for organization-based queries (most common access pattern)
CREATE INDEX idx_departments_organization_id
ON public.departments(organization_id)
WHERE is_active = true;

-- Index for display ordering
CREATE INDEX idx_departments_display_order
ON public.departments(organization_id, display_order, name)
WHERE is_active = true;

-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- STEP 4: RLS Policies
-- ============================================================================

-- Policy 1: Super Admin can view all departments
CREATE POLICY "super_admin_select_all_departments"
ON public.departments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
);

-- Policy 2: Users can view departments in their organization
CREATE POLICY "users_select_own_org_departments"
ON public.departments
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT profiles.organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
    )
);

-- Policy 3: Only admins can insert departments in their organization
CREATE POLICY "admin_insert_departments"
ON public.departments
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

-- Policy 4: Only admins can update departments in their organization
CREATE POLICY "admin_update_departments"
ON public.departments
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

-- Policy 5: Only admins can delete departments (soft delete recommended via is_active)
CREATE POLICY "admin_delete_departments"
ON public.departments
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

CREATE TRIGGER set_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Note: Assumes update_updated_at_column() function exists
-- If not, create it with:
-- CREATE OR REPLACE FUNCTION public.update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
