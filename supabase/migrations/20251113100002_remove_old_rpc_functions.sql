-- Migration: Remove old RPC functions for user deletion
-- Date: 2025-11-13
-- Purpose: Clean up legacy 5-layer architecture functions, now replaced by 2-layer Auth API approach

-- ============================================================================
-- Drop Legacy User Deletion Functions
-- ============================================================================

-- 1. Drop direct_delete_user_no_triggers
-- This function disabled all triggers (SET session_replication_role = replica)
-- causing loss of updated_at timestamps and audit trail
DROP FUNCTION IF EXISTS public.direct_delete_user_no_triggers(UUID);

-- 2. Drop admin_delete_user (both overloaded versions)
-- These functions performed redundant cleanup that CASCADE and triggers now handle
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID, TEXT, INTEGER);

-- 3. Drop delete_user_identities (if exists)
-- Auth API now handles auth.identities cleanup automatically
DROP FUNCTION IF EXISTS public.delete_user_identities(UUID);

-- ============================================================================
-- Verification: List remaining user-related functions
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE 'Remaining user-related functions after cleanup:';

    FOR func_record IN
        SELECT
            proname AS function_name,
            pg_get_function_identity_arguments(oid) AS arguments
        FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
          AND proname LIKE '%user%'
        ORDER BY proname
    LOOP
        RAISE NOTICE '  - %(%)', func_record.function_name, func_record.arguments;
    END LOOP;
END $$;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON SCHEMA public IS
'Public schema with simplified 2-layer user deletion architecture.
User deletion now uses Supabase Auth API + database triggers/CASCADE.
Legacy 5-layer RPC functions have been removed.';
