-- Migration: Set organization_id to NOT NULL on all tables
-- Created: 2025-11-07
-- Purpose: Enforce organization_id requirement after data migration
-- IMPORTANT: This must run AFTER data migration (20251107000005)

BEGIN;

-- Verify all data has organization_id before setting NOT NULL
-- This will fail the transaction if any NULL values exist

DO $$
DECLARE
    null_profiles INTEGER;
    null_patients INTEGER;
    null_items INTEGER;
    null_schedules INTEGER;
    null_executions INTEGER;
    null_notifications INTEGER;
    null_audit_logs INTEGER;
BEGIN
    -- Check for NULL organization_id values
    SELECT COUNT(*) INTO null_profiles FROM public.profiles WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_patients FROM public.patients WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_items FROM public.items WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_schedules FROM public.schedules WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_executions FROM public.schedule_executions WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_notifications FROM public.notifications WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_audit_logs FROM public.audit_logs WHERE organization_id IS NULL;

    IF null_profiles > 0 OR null_patients > 0 OR null_items > 0 OR
       null_schedules > 0 OR null_executions > 0 OR null_notifications > 0 OR
       null_audit_logs > 0 THEN
        RAISE EXCEPTION 'Cannot set NOT NULL: Found records without organization_id (profiles: %, patients: %, items: %, schedules: %, executions: %, notifications: %, audit_logs: %)',
            null_profiles, null_patients, null_items, null_schedules, null_executions, null_notifications, null_audit_logs;
    END IF;

    RAISE NOTICE '=== Verification Passed ===';
    RAISE NOTICE 'All records have organization_id set. Proceeding with NOT NULL constraints.';
END $$;

-- 1. Set NOT NULL on profiles
ALTER TABLE public.profiles
    ALTER COLUMN organization_id SET NOT NULL;

-- 2. Set NOT NULL on patients
ALTER TABLE public.patients
    ALTER COLUMN organization_id SET NOT NULL;

-- 3. Set NOT NULL on items
ALTER TABLE public.items
    ALTER COLUMN organization_id SET NOT NULL;

-- 4. Set NOT NULL on schedules
ALTER TABLE public.schedules
    ALTER COLUMN organization_id SET NOT NULL;

-- 5. Set NOT NULL on schedule_executions
ALTER TABLE public.schedule_executions
    ALTER COLUMN organization_id SET NOT NULL;

-- 6. Set NOT NULL on notifications
ALTER TABLE public.notifications
    ALTER COLUMN organization_id SET NOT NULL;

-- 7. Set NOT NULL on audit_logs
ALTER TABLE public.audit_logs
    ALTER COLUMN organization_id SET NOT NULL;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '=== NOT NULL Constraints Applied ===';
    RAISE NOTICE 'All tables now require organization_id';
END $$;

COMMIT;
