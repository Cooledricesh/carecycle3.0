-- Migration: Strengthen RLS policies with organization_id filtering
-- Priority: HIGH (Production deployment blocker)
-- Estimated time: 2-3 hours
-- Issue: PR #50 - Multiple tables lack organization_id filtering in INSERT/UPDATE policies

-- This migration adds organization_id verification to RLS policies
-- preventing cross-organization data access vulnerabilities

BEGIN;

-- ============================================================================
-- 1. join_requests table
-- ============================================================================
-- Issue: Current policy uses WITH CHECK (true), allowing any user to insert
-- Fix: Verify organization_id matches user's organization

DROP POLICY IF EXISTS "join_requests_insert_policy" ON public.join_requests;

CREATE POLICY "join_requests_secure_insert"
ON public.join_requests
FOR INSERT
WITH CHECK (
  -- Verify organization_id matches the user's organization
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "join_requests_update_policy" ON public.join_requests;

CREATE POLICY "join_requests_secure_update"
ON public.join_requests
FOR UPDATE
USING (
  -- Only allow updates to records in user's organization
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  -- Prevent moving records to different organization
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ============================================================================
-- 2. schedules table
-- ============================================================================
-- Issue: INSERT policy only checks is_user_active_and_approved()
-- Fix: Add organization_id verification

DROP POLICY IF EXISTS "Nurses and admins can insert schedules" ON public.schedules;

CREATE POLICY "schedules_secure_insert"
ON public.schedules
FOR INSERT
WITH CHECK (
  -- User must be active and approved
  is_user_active_and_approved()
  -- AND schedule must belong to user's organization
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Nurses and admins can update schedules" ON public.schedules;

CREATE POLICY "schedules_secure_update"
ON public.schedules
FOR UPDATE
USING (
  is_user_active_and_approved()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  is_user_active_and_approved()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ============================================================================
-- 3. patients table
-- ============================================================================
-- Issue: Basic authentication check without organization verification
-- Fix: Add organization_id scoping

DROP POLICY IF EXISTS "Nurses and admins can insert patients" ON public.patients;

CREATE POLICY "patients_secure_insert"
ON public.patients
FOR INSERT
WITH CHECK (
  is_user_active_and_approved()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Nurses and admins can update patients" ON public.patients;

CREATE POLICY "patients_secure_update"
ON public.patients
FOR UPDATE
USING (
  is_user_active_and_approved()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  is_user_active_and_approved()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ============================================================================
-- 4. items table
-- ============================================================================
-- Issue: Admin-only access without organization scoping
-- Fix: Verify admin is within same organization

DROP POLICY IF EXISTS "Admins can insert items" ON public.items;

CREATE POLICY "items_secure_insert"
ON public.items
FOR INSERT
WITH CHECK (
  -- Must be admin
  (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  -- AND item must belong to admin's organization
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update items" ON public.items;

CREATE POLICY "items_secure_update"
ON public.items
FOR UPDATE
USING (
  (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ============================================================================
-- 5. schedule_executions table
-- ============================================================================
-- Issue: Basic user approval check without verifying parent schedule's organization
-- Fix: Verify schedule belongs to user's organization

DROP POLICY IF EXISTS "Nurses and admins can insert schedule_executions" ON public.schedule_executions;

CREATE POLICY "schedule_executions_secure_insert"
ON public.schedule_executions
FOR INSERT
WITH CHECK (
  is_user_active_and_approved()
  -- Verify parent schedule belongs to user's organization
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    INNER JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = schedule_executions.schedule_id
      AND s.organization_id = p.organization_id
  )
);

DROP POLICY IF EXISTS "Nurses and admins can update schedule_executions" ON public.schedule_executions;

CREATE POLICY "schedule_executions_secure_update"
ON public.schedule_executions
FOR UPDATE
USING (
  is_user_active_and_approved()
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    INNER JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = schedule_executions.schedule_id
      AND s.organization_id = p.organization_id
  )
)
WITH CHECK (
  is_user_active_and_approved()
  AND EXISTS (
    SELECT 1
    FROM public.schedules s
    INNER JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = schedule_executions.schedule_id
      AND s.organization_id = p.organization_id
  )
);

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- This migration addresses security gaps identified in PR #50 review
-- All affected tables now enforce organization-level data isolation
--
-- Tables updated:
-- 1. join_requests - Added organization_id verification
-- 2. schedules - Added organization_id verification
-- 3. patients - Added organization_id verification
-- 4. items - Added organization-scoped admin access
-- 5. schedule_executions - Added parent schedule organization verification
--
-- Testing checklist:
-- [ ] Test INSERT with correct organization_id succeeds
-- [ ] Test INSERT with wrong organization_id fails
-- [ ] Test UPDATE within same organization succeeds
-- [ ] Test UPDATE across organizations fails
-- [ ] Test admin operations scoped to their organization
