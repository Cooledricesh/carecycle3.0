-- Migration: Add indexes to organization_id columns for performance optimization
-- Purpose: Improve query performance for all organization-scoped queries
-- Author: Senior Engineer
-- Date: 2025-11-08

BEGIN;

-- Add index to profiles.organization_id
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id
ON public.profiles(organization_id);

-- Add index to patients.organization_id
CREATE INDEX IF NOT EXISTS idx_patients_organization_id
ON public.patients(organization_id);

-- Add index to items.organization_id
CREATE INDEX IF NOT EXISTS idx_items_organization_id
ON public.items(organization_id);

-- Add index to schedules.organization_id
CREATE INDEX IF NOT EXISTS idx_schedules_organization_id
ON public.schedules(organization_id);

-- Add index to schedule_executions.organization_id
CREATE INDEX IF NOT EXISTS idx_schedule_executions_organization_id
ON public.schedule_executions(organization_id);

-- Add index to notifications.organization_id
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id
ON public.notifications(organization_id);

-- Add index to audit_logs.organization_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id
ON public.audit_logs(organization_id);

-- Add composite indexes for frequently queried combinations
-- Profiles: organization_id + is_active (for active user queries)
CREATE INDEX IF NOT EXISTS idx_profiles_org_active
ON public.profiles(organization_id, is_active)
WHERE is_active = true;

-- Patients: organization_id + is_active (for active patient queries)
CREATE INDEX IF NOT EXISTS idx_patients_org_active
ON public.patients(organization_id, is_active)
WHERE is_active = true;

-- Items: organization_id + category + is_active (for category filtering)
CREATE INDEX IF NOT EXISTS idx_items_org_category_active
ON public.items(organization_id, category, is_active)
WHERE is_active = true;

-- Schedules: organization_id + status (for active schedule queries)
CREATE INDEX IF NOT EXISTS idx_schedules_org_status
ON public.schedules(organization_id, status)
WHERE status = 'active';

-- Schedules: organization_id + next_due_date (for due date queries)
CREATE INDEX IF NOT EXISTS idx_schedules_org_next_due_date
ON public.schedules(organization_id, next_due_date)
WHERE status = 'active';

-- Audit logs: organization_id + timestamp (for log queries with date range)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp
ON public.audit_logs(organization_id, timestamp DESC);

COMMIT;

COMMENT ON INDEX public.idx_profiles_organization_id IS 'Performance: organization_id lookup for profiles table';
COMMENT ON INDEX public.idx_patients_organization_id IS 'Performance: organization_id lookup for patients table';
COMMENT ON INDEX public.idx_items_organization_id IS 'Performance: organization_id lookup for items table';
COMMENT ON INDEX public.idx_schedules_organization_id IS 'Performance: organization_id lookup for schedules table';
COMMENT ON INDEX public.idx_schedule_executions_organization_id IS 'Performance: organization_id lookup for schedule_executions table';
COMMENT ON INDEX public.idx_notifications_organization_id IS 'Performance: organization_id lookup for notifications table';
COMMENT ON INDEX public.idx_audit_logs_organization_id IS 'Performance: organization_id lookup for audit_logs table';
