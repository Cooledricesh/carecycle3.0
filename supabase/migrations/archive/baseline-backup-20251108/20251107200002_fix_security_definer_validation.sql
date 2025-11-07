-- Migration: Fix SECURITY DEFINER Validation Security Vulnerability (CVSS 9.0+)
-- Created: 2025-11-07
-- Purpose: Add caller verification and organization membership validation to get_filter_statistics
-- Security Issue: Users could query statistics for other users and other organizations

BEGIN;

-- Fix get_filter_statistics to validate caller and organization membership
CREATE OR REPLACE FUNCTION public.get_filter_statistics(
    p_organization_id uuid,
    p_user_id uuid
)
RETURNS TABLE(
    total_patients integer,
    my_patients integer,
    total_schedules integer,
    today_schedules integer,
    overdue_schedules integer,
    upcoming_schedules integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_role TEXT;
    v_user_care_type TEXT;
    v_user_org_id UUID;
BEGIN
    -- SECURITY FIX 1: Verify caller is querying their own data
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot access other user statistics';
    END IF;

    -- Get user role, care_type, and organization_id
    SELECT role, care_type, organization_id INTO v_user_role, v_user_care_type, v_user_org_id
    FROM profiles
    WHERE id = p_user_id;

    -- SECURITY FIX 2: Verify user is member of requested organization
    IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    RETURN QUERY
    SELECT
        -- Total patients visible to user (filtered by organization)
        (SELECT COUNT(DISTINCT p.id)::INTEGER
         FROM patients p
         WHERE p.organization_id = p_organization_id
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- My patients (for doctors, filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM patients
         WHERE organization_id = p_organization_id
            AND doctor_id = p_user_id
        ),
        -- Total schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status IN ('active', 'paused')
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Today's schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date = CURRENT_DATE
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Overdue schedules (filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date < CURRENT_DATE
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        ),
        -- Upcoming schedules (next 7 days, filtered by organization)
        (SELECT COUNT(*)::INTEGER
         FROM schedules s
         INNER JOIN patients p ON s.patient_id = p.id
         WHERE p.organization_id = p_organization_id
            AND s.status = 'active'
            AND s.next_due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
            AND (v_user_role = 'admin'
                OR (v_user_role = 'doctor' AND p.doctor_id = p_user_id)
                OR (v_user_role = 'nurse' AND p.care_type = v_user_care_type))
        );
END;
$$;

COMMIT;

-- Security Audit Notes:
-- This migration fixes CVSS 9.0+ vulnerability where users could query
-- statistics for other users and other organizations.
--
-- Changes:
-- 1. Added validation: p_user_id must match auth.uid()
-- 2. Added organization membership check: user's org must match p_organization_id
-- 3. Error messages:
--    - 'Cannot access other user statistics' (caller mismatch)
--    - 'Not a member of this organization' (org membership mismatch)
--
-- Expected Test Behavior:
-- - User A calls RPC with p_user_id = User A, p_organization_id = User A's Org → ALLOWED
-- - User A calls RPC with p_user_id = User B, p_organization_id = User B's Org → BLOCKED (caller mismatch)
-- - User A calls RPC with p_user_id = User A, p_organization_id = Org B → BLOCKED (org mismatch)
--
-- Double Protection:
-- 1. Ensures caller can only query their own statistics
-- 2. Ensures statistics are only for organizations they belong to
