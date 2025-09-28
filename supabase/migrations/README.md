# Supabase Migrations

This directory contains the complete database schema migration for the medical scheduling system.

## Current Migration Structure

### Active Migration
- `00000000000001_complete_schema.sql` - **Complete, reproducible schema** (1,340 lines)
  - All tables, indexes, constraints
  - All functions and triggers
  - All RLS policies
  - All views and materialized views
  - Production-ready and idempotent

### Archived Migrations
The `archive/` directory contains 76 historical migration files that were used during development. These are kept for reference but are **not required** for database setup.

## Fresh Database Setup

To set up a new Supabase database with identical schema:

### Option 1: Via Supabase Dashboard (Recommended)
1. Log into your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `00000000000001_complete_schema.sql`
4. Paste and execute in SQL Editor
5. Verify: Check Tables, Functions, and RLS sections

### Option 2: Via Supabase CLI
```bash
supabase db push
```

The CLI will automatically apply `00000000000001_complete_schema.sql`.

## Schema Components

### Tables (11)
- `profiles` - User profiles with role-based access
- `patients` - Patient records
- `items` - Medical test/injection items
- `schedules` - Recurring schedule definitions
- `schedule_executions` - Individual execution records
- `notifications` - Notification queue
- `schedule_logs` - Audit trail for schedules
- `patient_schedules` - Appointment scheduling
- `audit_logs` - System-wide audit trail
- `user_preferences` - User settings
- `query_performance_log` - Performance monitoring

### Enums (7)
- `user_role`: nurse, admin, doctor
- `approval_status`: pending, approved, rejected
- `schedule_status`: active, paused, completed, deleted, cancelled
- `execution_status`: planned, completed, skipped, overdue
- `notification_state`: pending, ready, sent, failed, cancelled
- `notification_channel`: dashboard, push, email
- `appointment_type`: consultation, treatment, follow_up, emergency, routine_check

### Key Functions
- User management: `approve_user()`, `is_admin()`, `handle_new_user()`
- Schedule management: `calculate_next_due_date()`, `handle_schedule_pause_flow()`
- Calendar: `get_calendar_schedules_filtered()`
- Patient management: `archive_patient_with_timestamp()`, `restore_patient_atomic()`
- Assignment tracking: `capture_assignment_at_completion()`

### Security
- Row Level Security (RLS) enabled on all user-facing tables
- 42 RLS policies for fine-grained access control
- Role-based permissions (nurse, admin, doctor)
- User approval workflow

## Migration History

**Generated:** 2025-09-28

**Source:** Extracted from production database using Supabase MCP tools

**Purpose:** Ensure complete reproducibility of database schema across environments

## Verification

After applying the migration, verify:

```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: 11

-- Check enum count
SELECT COUNT(DISTINCT typname) FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public';
-- Expected: 7

-- Check function count
SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
AND routine_name NOT LIKE 'gtrgm%'
AND routine_name NOT LIKE '%trgm%';
-- Expected: 40+

-- Check RLS policies
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
-- Expected: 42 total policies
```

## Notes

- The migration is **idempotent** - safe to run multiple times
- All statements use `IF NOT EXISTS` or `IF EXISTS` checks
- Wrapped in transaction (`BEGIN`/`COMMIT`)
- Dependency-ordered (tables → constraints → functions → triggers → policies)
- Archived migrations are historical and not required for setup