-- Migration: Add organization_id foreign keys to all existing tables
-- Created: 2025-11-07
-- Purpose: Link all data tables to organizations for multi-tenant isolation

BEGIN;

-- IMPORTANT: Adding organization_id as NULLABLE first
-- Will be set to NOT NULL after data migration in a later migration

-- 1. Add organization_id to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization
    ON public.profiles (organization_id);

COMMENT ON COLUMN public.profiles.organization_id IS '사용자가 소속된 조직 ID';

-- 2. Add organization_id to patients
ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_patients_organization
    ON public.patients (organization_id);

COMMENT ON COLUMN public.patients.organization_id IS '환자가 속한 조직 ID';

-- 3. Add organization_id to items
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_items_organization
    ON public.items (organization_id);

COMMENT ON COLUMN public.items.organization_id IS '항목이 속한 조직 ID';

-- 4. Add organization_id to schedules
ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedules_organization
    ON public.schedules (organization_id);

COMMENT ON COLUMN public.schedules.organization_id IS '일정이 속한 조직 ID';

-- 5. Add organization_id to schedule_executions
ALTER TABLE public.schedule_executions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedule_executions_organization
    ON public.schedule_executions (organization_id);

COMMENT ON COLUMN public.schedule_executions.organization_id IS '시행 기록이 속한 조직 ID';

-- 6. Add organization_id to notifications
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_organization
    ON public.notifications (organization_id);

COMMENT ON COLUMN public.notifications.organization_id IS '알림이 속한 조직 ID';

-- 7. Add organization_id to audit_logs
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization
    ON public.audit_logs (organization_id);

COMMENT ON COLUMN public.audit_logs.organization_id IS '감사 로그가 속한 조직 ID';

COMMIT;
