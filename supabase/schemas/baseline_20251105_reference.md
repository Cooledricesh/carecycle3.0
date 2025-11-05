# Database Schema Baseline Reference

**Created**: November 5, 2025
**Purpose**: Reference snapshot of production database schema
**Project**: xlhtmakvxbdjnpvtzdqh (Carescheduler)
**Applied Migrations**: 60 migrations

---

## Overview

This document serves as a quick reference for the current production database schema state. For complete schema details, see `/docs/db/dbschema.md`.

**Usage:**
- Reference for new environment setup
- Schema comparison before/after changes
- Quick lookup for table structures and relationships

---

## Core Tables (11 total)

### User & Authentication
1. **profiles** - User profiles with approval workflow
   - Primary Key: `id` (uuid, references auth.users)
   - Role types: nurse, admin, doctor
   - Approval system: approval_status, approved_by, approved_at
   - Care type assignment for nurses

### Patient Management
2. **patients** - Patient information (simplified, no encryption)
   - Primary Key: `id` (uuid)
   - Unique constraint on patient_number (active + non-archived)
   - Doctor assignment: doctor_id (registered) OR assigned_doctor_name (pending)
   - Archiving support: archived, archived_at, original_patient_number

3. **items** - Medical procedures and treatments catalog
   - Primary Key: `id` (uuid)
   - Categories: injection, test, other (simplified from 5 to 3)
   - Intervals in weeks: default_interval_weeks

### Scheduling System
4. **schedules** - Recurring schedule definitions
   - Primary Key: `id` (uuid)
   - References: patient_id, item_id
   - Interval in weeks: interval_weeks (NOT days)
   - Statuses: active, paused, completed, deleted, cancelled

5. **schedule_executions** - Individual execution records
   - Primary Key: `id` (uuid)
   - Unique constraint: (schedule_id, planned_date)
   - Execution context: doctor_id_at_completion, care_type_at_completion
   - Statuses: planned, completed, skipped, overdue

6. **notifications** - System notifications
   - Primary Key: `id` (uuid)
   - References: schedule_id OR execution_id
   - Unique constraints prevent duplicates per schedule/execution/date
   - States: pending, ready, sent, failed, cancelled

### Audit & Logging
7. **schedule_logs** - Schedule change audit trail
   - Primary Key: `id` (uuid)
   - Tracks: action, old_values, new_values, changed_by

8. **audit_logs** - System-wide audit logging
   - Primary Key: `id` (uuid)
   - **CRITICAL**: user_name column preserves username even if user deleted
   - Complete context: user_id, user_email, user_role, ip_address, user_agent

### Legacy & Support
9. **patient_schedules** - Legacy appointment scheduling (kept for compatibility)
10. **user_preferences** - User preferences storage
11. **query_performance_log** - Performance monitoring

---

## Custom Enums (7 total)

```sql
-- User roles
user_role: 'nurse', 'admin', 'doctor'

-- Approval workflow
approval_status: 'pending', 'approved', 'rejected'

-- Schedule statuses
schedule_status: 'active', 'paused', 'completed', 'deleted', 'cancelled'

-- Execution statuses
execution_status: 'planned', 'completed', 'skipped', 'overdue'

-- Notification settings
notification_channel: 'dashboard', 'push', 'email'
notification_state: 'pending', 'ready', 'sent', 'failed', 'cancelled'

-- Legacy appointment types
appointment_type: 'consultation', 'treatment', 'follow_up', 'emergency', 'routine_check'
```

---

## Key Functions

### Security & User Management
- `is_user_active_and_approved()` - Core RLS security check
- `is_user_admin()` - Admin verification
- `approve_user()`, `reject_user()`, `deactivate_user()` - User management
- `admin_delete_user()` - Admin user deletion with cascade

### Patient Management
- `archive_patient_with_timestamp()` - Archive with timestamp suffix
- `restore_archived_patient()` - Restore from archive
- `auto_link_doctor_on_signup()` - Auto-link patients when doctors register
- `get_pending_doctor_names()` - List unregistered doctor assignments

### Schedule Management
- `validate_schedule_resume()` - Validate resume with new due date
- `get_schedule_pause_statistics()` - Pause/resume analytics
- `calculate_next_due_date()` - Auto-calculate next due date
- `get_filtered_schedules()` - Role-based filtered schedules

### Calendar & Statistics (December 2025 additions)
- `get_calendar_schedules()` - Combined schedule + execution view
- `get_calendar_schedules_filtered()` - Filtered calendar view
- `get_schedule_statistics()` - Execution analytics per schedule

### Performance & Monitoring
- `get_today_checklist()` - Today's due items
- `get_db_stats()` - Database statistics (admin only)
- `refresh_views()` - Manual view refresh

---

## Materialized Views & Views

### Materialized Views
- **dashboard_schedule_summary** - Optimized dashboard data
  - Indexes: care_type + next_due_date, doctor_id + next_due_date, urgency_level + next_due_date

### Regular Views
- **patient_doctor_view** - Unified patient-doctor assignments (registered, pending, unassigned)
- **calendar_monthly_summary** - Monthly statistics for calendar dashboard
- **dashboard_summary** - General dashboard data
- **performance_metrics** - Table sizes and statistics

---

## Critical Indexes

### High-Performance Indexes (schedule_executions)
- `idx_executions_for_calendar` - Completed executions for calendar
- `idx_executions_calendar_range` - Calendar range with included columns
- `idx_executions_active_status` - Active planned/overdue executions
- `idx_executions_schedule_join` - Schedule join optimization
- `idx_schedule_executions_care_type_completion` - Care type tracking
- `idx_schedule_executions_doctor_completion` - Doctor tracking

### Core Table Indexes
- **patients**: patient_number, care_type, doctor_id, archived status
- **schedules**: patient_id, item_id, status, next_due_date, composite indexes
- **profiles**: role, care_type, approval status

---

## Row Level Security (RLS)

### Security Model
- **Core Principle**: No medical data access without approval
- **All tables**: Require `is_user_active_and_approved()` check
- **Admin oversight**: Full access to all data
- **Audit trail**: All operations logged

### Key Policies
- profiles: Own profile OR admin
- patients/schedules/executions: Active approved users only
- items: Read all, modify admin only
- notifications: Own notifications OR admin
- audit_logs: Admin only

---

## Triggers

### Auto-Update Triggers
- All major tables have `update_updated_at_column` trigger
- **Note**: Some tables have duplicate triggers (cleanup recommended)

### Business Logic Triggers
- `trigger_calculate_next_due` - Auto-calculate next due on execution completion
- `trigger_schedule_state_change` - Handle schedule state transitions (simplified)
- `auto_link_doctor_on_profile_create` - Auto-link patients on doctor registration
- `on_auth_user_created` - Create profile on user signup
- `capture_assignment_before_completion` - Capture doctor/care_type context

### Audit Triggers
- `audit_profiles_trigger`, `audit_patients_trigger`, `audit_schedules_trigger`
- Comprehensive change tracking for all operations

---

## Migration History

**Total Applied**: 60 migrations
**Latest**: 20250929032910_simplify_item_category_enum
**Period**: August 2025 - September 2025

### Key Milestones
- August 2025: Foundation (authentication, core tables, approval system)
- September 2-13: User approval, archiving, pause/resume system
- September 14-19: Conflict resolution, trigger optimization
- September 20-25: Doctor role, RLS policies, permissions
- September 28-29: Audit logs enhancement, flexible doctor assignment
- December 2025: Calendar integration, execution tracking

---

## Important Notes

### ⚠️ Breaking Changes in History
1. **interval_days → interval_weeks** (September 2, 2025)
   - All schedule intervals now in weeks, not days
   - Migration: 20250902035004

2. **department → care_type** (September 2025)
   - Column renamed in profiles and patients tables

3. **Item categories simplified** (September 30, 2025)
   - Reduced from 5 categories to 3 (injection, test, other)

### 🔐 Security Enhancements
- User approval system (September 2, 2025)
- All "allow all" RLS policies removed
- SECURITY DEFINER search path fixes
- Comprehensive audit logging with user_name preservation

### 📊 Performance Optimizations
- Materialized views for dashboard
- Comprehensive indexing strategy
- Filtered indexes for active records
- Calendar-optimized query functions

---

## For Detailed Information

**Complete schema documentation**: `/docs/db/dbschema.md` (v3.0.0)
**Migration status**: `/docs/db/migration-status.md`
**Applied migrations list**: Query `supabase_migrations.schema_migrations` table

---

**Document Version**: 1.0.0
**Created**: November 5, 2025
**Purpose**: Quick reference and baseline snapshot
**Status**: Production schema as of 60 applied migrations
