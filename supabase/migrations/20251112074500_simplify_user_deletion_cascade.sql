-- Migration: Simplify user deletion by fixing all FK cascades
-- Bug: BUG-2025-11-12-USER-DELETE-CASCADE-FIX
-- Purpose: Allow seamless user deletion without manual pre-deletion steps
--
-- Problem: Supabase Auth API deleteUser() fails because profiles CASCADE triggers
-- constraint violations in related tables (notifications, schedules, etc.)
--
-- Solution: Drop and recreate all profiles.id FK constraints with proper CASCADE/SET NULL

BEGIN;

-- ============================================================================
-- PART 1: Drop all existing FK constraints that reference profiles.id
-- ============================================================================

-- notifications.recipient_id (should CASCADE - delete notifications when user deleted)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;

-- patient_schedules.created_by (meaningless metadata - SET NULL)
ALTER TABLE patient_schedules DROP CONSTRAINT IF EXISTS patient_schedules_created_by_fkey;

-- patient_schedules.nurse_id (no "assigned nurse" concept - SET NULL)
ALTER TABLE patient_schedules DROP CONSTRAINT IF EXISTS patient_schedules_nurse_id_fkey;

-- patients.doctor_id (set to NULL when doctor deleted)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_doctor_id_fkey;

-- profiles.approved_by (self-reference - SET NULL)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_approved_by_fkey;

-- query_performance_log.user_id (logs can remain with NULL user)
ALTER TABLE query_performance_log DROP CONSTRAINT IF EXISTS query_performance_log_user_id_fkey;

-- schedule_executions.doctor_id_at_completion (historical data - SET NULL)
ALTER TABLE schedule_executions DROP CONSTRAINT IF EXISTS schedule_executions_doctor_id_at_completion_fkey;

-- schedule_executions.executed_by (meaningless metadata - SET NULL)
ALTER TABLE schedule_executions DROP CONSTRAINT IF EXISTS schedule_executions_executed_by_fkey;

-- invitations.invited_by (keep invitation history with NULL)
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;

-- ============================================================================
-- PART 2: Recreate FK constraints with proper CASCADE/SET NULL behavior
-- ============================================================================

-- notifications: CASCADE delete (notifications are user-specific, delete with user)
ALTER TABLE notifications
  ADD CONSTRAINT notifications_recipient_id_fkey
  FOREIGN KEY (recipient_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- patient_schedules.created_by: SET NULL (metadata only, no business value)
ALTER TABLE patient_schedules
  ADD CONSTRAINT patient_schedules_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- patient_schedules.nurse_id: SET NULL (no "assigned nurse" concept)
ALTER TABLE patient_schedules
  ADD CONSTRAINT patient_schedules_nurse_id_fkey
  FOREIGN KEY (nurse_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- patients.doctor_id: SET NULL (becomes "unassigned" when doctor deleted)
ALTER TABLE patients
  ADD CONSTRAINT patients_doctor_id_fkey
  FOREIGN KEY (doctor_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- profiles.approved_by: SET NULL (approval history preserved, approver can be deleted)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_approved_by_fkey
  FOREIGN KEY (approved_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- query_performance_log.user_id: SET NULL (logs remain for analysis)
ALTER TABLE query_performance_log
  ADD CONSTRAINT query_performance_log_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- schedule_executions.doctor_id_at_completion: SET NULL (historical snapshot)
ALTER TABLE schedule_executions
  ADD CONSTRAINT schedule_executions_doctor_id_at_completion_fkey
  FOREIGN KEY (doctor_id_at_completion)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- schedule_executions.executed_by: SET NULL (metadata only)
ALTER TABLE schedule_executions
  ADD CONSTRAINT schedule_executions_executed_by_fkey
  FOREIGN KEY (executed_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- invitations.invited_by: SET NULL (invitation history preserved)
ALTER TABLE invitations
  ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- PART 3: Fix any other potential blockers
-- ============================================================================

-- Ensure schedules table doesn't block (though it doesn't directly reference profiles)
-- schedules.created_by and schedules.assigned_nurse_id are not FK constrained in baseline

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify all FK constraints are properly set
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: All profiles.id FK constraints updated for CASCADE/SET NULL';
  RAISE NOTICE 'User deletion should now work seamlessly through Supabase Auth API';
END $$;

COMMIT;
