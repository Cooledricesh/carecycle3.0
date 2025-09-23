# Comprehensive Database Schema Documentation

**Last Updated**: September 22, 2025
**Schema Version**: 2.5.0 (Current Production State - Verified)
**Migration Count**: 24+ migrations applied
**Direct DB Verification**: 2025-09-22  

## Overview

This document provides a complete and accurate description of the medical scheduling system database schema as it exists in production after all migrations through September 2025. This replaces all previous schema documentation.

### Key Recent Changes (September 2025)
- **User Approval System**: Comprehensive HIPAA-compliant access control implemented
- **Patient Archiving**: Full patient archiving and restoration system
- **Security Hardening**: All "allow all" RLS policies replaced with secure policies
- **Performance Optimization**: Materialized views and optimized query functions
- **Schedule Pause/Resume System**: Complete pause/resume workflow with data integrity
- **Notification State Enhancement**: Added 'cancelled' state to notification_state enum
- **Conflict Resolution**: Unique constraints and conflict handling for notifications

---

## Core Tables

### 1. profiles
**Purpose**: User profile and authentication management with approval workflow
**Created**: 2025-08-16 | **Enhanced**: 2025-09-02 (User Approval System) | **Verified**: 2025-09-22

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE | User ID from Supabase auth |
| email | text | NOT NULL | User email address |
| name | text | NOT NULL | User display name |
| role | user_role | NOT NULL DEFAULT 'nurse' | User role (nurse, admin, **doctor**) |
| **care_type** | text | NULL | Care type assignment for nurses (외래/입원/낮병원), NULL for admin/doctor roles |
| phone | text | NULL | Contact phone number |
| is_active | boolean | NOT NULL DEFAULT true | User activation status |
| **approval_status** | approval_status | NOT NULL DEFAULT 'pending' | Approval workflow status |
| **approved_by** | uuid | NULL REFERENCES profiles(id) | Admin who approved the user |
| **approved_at** | timestamptz | NULL | Timestamp of approval |
| **rejection_reason** | text | NULL | Reason for rejection (if any) |
| created_at | timestamptz | DEFAULT NOW() | Creation timestamp |
| updated_at | timestamptz | DEFAULT NOW() | Last update timestamp |

**Enums**:
- `user_role`: 'nurse', 'admin', **'doctor'** (doctor role added)
- `approval_status`: 'pending', 'approved', 'rejected'

**Important Changes**:
- **department** column has been **replaced** with **care_type**
- **doctor** role has been added to user_role enum

**Key Changes**:
- **SECURITY CRITICAL**: New users default to `is_active=true` and `approval_status='pending'`
- Requires admin approval before accessing medical data
- Added audit trail for approval actions

### 2. patients
**Purpose**: Patient information (simplified, no encryption)
**Created**: 2025-08-18 | **Enhanced**: 2025-09-09 (Archiving Support) | **Verified**: 2025-09-22

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY DEFAULT gen_random_uuid() | Patient unique identifier |
| patient_number | text | NOT NULL | Patient identification number |
| name | text | NOT NULL | Patient full name |
| **care_type** | text | NULL, CHECK (care_type IN ('외래','입원','낮병원')) | Type of care: 외래/입원/낮병원 |
| **doctor_id** | uuid | NULL REFERENCES profiles(id) | Assigned doctor ID |
| is_active | boolean | DEFAULT true | Active status |
| **archived** | boolean | DEFAULT false | Archival status |
| **archived_at** | timestamptz | NULL | Archival timestamp |
| **original_patient_number** | text | NULL | Original number before archiving |
| metadata | jsonb | DEFAULT '{}' | Additional patient data |
| created_by | uuid | REFERENCES auth.users(id) | User who created record |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Note**: hospital_id column is not present in current production database

**Unique Constraints**:
- `unique_active_patient_number`: Unique constraint on `patient_number` WHERE `is_active = true AND archived = false`

**Key Changes**:
- **NO ENCRYPTION**: Simplified from original encrypted design for development
- **Archiving System**: Prevents unique constraint conflicts during restoration
- Added care_type field for patient classification

### 3. items
**Purpose**: Medical procedures, tests, and treatments catalog  
**Created**: 2025-08-18 | **Updated**: 2024-08-26 (Interval Conversion)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY DEFAULT gen_random_uuid() | Item unique identifier |
| code | text | UNIQUE NOT NULL | Item code (e.g., 'INJ001') |
| name | text | NOT NULL | Item name |
| category | text | NOT NULL CHECK (category IN ('injection', 'test', 'treatment', 'medication', 'other')) | Item category |
| **default_interval_weeks** | integer | NULL CHECK (> 0) | Default interval in weeks |
| description | text | NULL | Detailed description |
| instructions | text | NULL | Execution instructions |
| preparation_notes | text | NULL | Pre-procedure notes |
| requires_notification | boolean | DEFAULT true | Whether notifications are needed |
| notification_days_before | integer | DEFAULT 7 | Days before to notify |
| is_active | boolean | DEFAULT true | Active status |
| sort_order | integer | DEFAULT 0 | Display order |
| metadata | jsonb | DEFAULT '{}' | Additional item data |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Key Changes**:
- **Interval Units**: Changed from `default_interval_days` to `default_interval_weeks` (2024-08-26)
- Pre-loaded with psychiatric medication injection schedules

### 4. schedules
**Purpose**: Recurring medical schedule definitions  
**Created**: 2025-08-18 | **Major Update**: 2025-09-02 (Interval Weeks)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY DEFAULT gen_random_uuid() | Schedule unique identifier |
| patient_id | uuid | NOT NULL REFERENCES patients(id) ON DELETE CASCADE | Associated patient |
| item_id | uuid | NOT NULL REFERENCES items(id) ON DELETE RESTRICT | Medical item/procedure |
| **interval_weeks** | integer | NOT NULL CHECK (> 0 AND <= 52) | Interval in weeks |
| start_date | date | NOT NULL | Schedule start date |
| end_date | date | NULL CHECK (>= start_date) | Optional end date |
| last_executed_date | date | NULL | Last execution date |
| next_due_date | date | NOT NULL CHECK (>= start_date) | Next scheduled date |
| status | schedule_status | DEFAULT 'active' | Schedule status |
| assigned_nurse_id | uuid | REFERENCES auth.users(id) | Assigned nurse |
| notes | text | NULL | Schedule notes |
| priority | integer | DEFAULT 0 | Priority level |
| requires_notification | boolean | DEFAULT false | Notification requirement |
| notification_days_before | integer | DEFAULT 7 CHECK (>= 0) | Notification timing |
| created_by | uuid | REFERENCES auth.users(id) | Schedule creator |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Enums**:
- `schedule_status`: 'active', 'paused', 'completed', 'cancelled'

**Key Changes**:
- **BREAKING**: Renamed `interval_days` to `interval_weeks` (2025-09-02)
- Enhanced constraints for notification logic

### 5. schedule_executions
**Purpose**: Individual execution records for schedules  
**Created**: 2025-08-18 | **Enhanced**: 2025-09-02 (Constraint Strategy)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY DEFAULT gen_random_uuid() | Execution unique identifier |
| schedule_id | uuid | NOT NULL REFERENCES schedules(id) ON DELETE CASCADE | Associated schedule |
| planned_date | date | NOT NULL | Originally planned date |
| executed_date | date | NULL | Actual execution date |
| executed_time | time | NULL | Execution time |
| status | execution_status | DEFAULT 'planned' | Execution status |
| executed_by | uuid | REFERENCES auth.users(id) | Executing staff member |
| notes | text | NULL | Execution notes |
| skipped_reason | text | NULL | Reason if skipped |
| is_rescheduled | boolean | DEFAULT false | Rescheduling flag |
| original_date | date | NULL | Original date if rescheduled |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Unique Constraints**:
- `unique_schedule_date`: UNIQUE (schedule_id, planned_date)

**Enums**:
- `execution_status`: 'planned', 'completed', 'skipped', 'overdue'

**Key Features**:
- Automatic next due date calculation via triggers
- Constraint improvements for data integrity

### 6. notifications
**Purpose**: System notifications and alerts  
**Created**: 2025-08-18

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY DEFAULT gen_random_uuid() | Notification unique identifier |
| schedule_id | uuid | NULL REFERENCES schedules(id) ON DELETE CASCADE | Related schedule |
| execution_id | uuid | NULL REFERENCES schedule_executions(id) ON DELETE CASCADE | Related execution |
| recipient_id | uuid | NOT NULL REFERENCES auth.users(id) | Notification recipient |
| channel | notification_channel | NOT NULL | Delivery channel |
| notify_date | date | NOT NULL | Notification date |
| notify_time | time | DEFAULT '09:00' | Notification time |
| state | notification_state | DEFAULT 'pending' | Notification state |
| title | text | NOT NULL | Notification title |
| message | text | NOT NULL | Notification message |
| metadata | jsonb | DEFAULT '{}' | Additional data |
| sent_at | timestamptz | NULL | Delivery timestamp |
| error_message | text | NULL | Error details if failed |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Enums**:
- `notification_channel`: 'dashboard', 'push', 'email'
- `notification_state`: 'pending', 'ready', 'sent', 'failed', 'cancelled'

**Constraints**:
- Must reference either schedule_id OR execution_id

**Unique Indexes** (Added September 14, 2025):
- `idx_notifications_unique_schedule_date`: UNIQUE (schedule_id, notify_date) WHERE schedule_id IS NOT NULL
- `idx_notifications_unique_execution_date`: UNIQUE (execution_id, notify_date) WHERE execution_id IS NOT NULL

---

## Supporting Tables

### 7. schedule_logs
**Purpose**: Audit trail for schedule changes

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Log entry identifier |
| schedule_id | uuid | Associated schedule |
| action | text | Action performed |
| old_values | jsonb | Previous values |
| new_values | jsonb | New values |
| changed_by | uuid | User who made changes |
| changed_at | timestamptz | Change timestamp |
| reason | text | Change reason |

### 8. audit_logs
**Purpose**: System-wide audit logging  
**Created**: 2025-08-16 | **Enhanced**: 2025-09-02

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Audit log identifier |
| table_name | text | Table being audited |
| operation | text | Operation type (INSERT, UPDATE, DELETE) |
| record_id | uuid | Record being changed |
| old_values | jsonb | Previous values |
| new_values | jsonb | New values |
| user_id | uuid | User performing action |
| user_email | text | User email |
| user_role | text | User role |
| timestamp | timestamptz | Operation timestamp |
| ip_address | inet | Client IP address |
| user_agent | text | Client user agent |

### 9. patient_schedules
**Purpose**: Legacy appointment scheduling (kept for compatibility)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Schedule identifier |
| patient_name | text | Patient name |
| patient_phone | text | Patient phone |
| patient_email | text | Patient email |
| nurse_id | uuid | Assigned nurse |
| appointment_type | appointment_type | Appointment type |
| scheduled_date | text | Scheduled date |
| scheduled_time | text | Scheduled time |
| duration_minutes | integer | Duration |
| status | schedule_status | Status |
| notes | text | Notes |
| department | text | Department |
| room_number | text | Room number |
| created_by | uuid | Creator |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Update time |

---

## Views

### Materialized Views

#### dashboard_schedule_summary
**Purpose**: Optimized view for dashboard performance
**Created**: 2025 | **Verified**: 2025-09-22
**Columns**:
- All schedule fields (id, patient_id, item_id, etc.)
- patient_name, patient_care_type, patient_number
- doctor_id, doctor_name (from profiles join)
- item_name, item_category (from items join)
- urgency_level (calculated: 'overdue', 'due_today', 'upcoming', 'future')
**Filters**: Only active and paused schedules
**Indexes**:
- idx_dashboard_summary_care_type (care_type, next_due_date)
- idx_dashboard_summary_doctor (doctor_id, next_due_date)

### System Views

#### database_health
**Purpose**: System health monitoring

#### performance_metrics
**Purpose**: Table size and performance statistics

#### pending_users
**Purpose**: Users awaiting approval (admin only)

#### today_checklist
**Purpose**: Today's scheduled items (from types file)

---

## Functions and Stored Procedures

### User Management Functions

#### is_user_active_and_approved()
**Purpose**: Security check for active, approved users  
**Returns**: boolean  
**Usage**: Core security function used in all RLS policies

#### is_user_admin()
**Purpose**: Admin role verification  
**Returns**: boolean  
**Usage**: Admin-only operations

#### approve_user(user_id, approved_by_id)
**Purpose**: Admin function to approve pending users  
**Security**: Admin only, updates approval_status and is_active

#### reject_user(user_id, reason, rejected_by_id)
**Purpose**: Admin function to reject pending users  
**Security**: Admin only, sets rejection reason

#### deactivate_user(user_id, reason)
**Purpose**: Admin function to deactivate users  
**Security**: Admin only, prevents self-deactivation

### Patient Archiving Functions

#### archive_patient_with_timestamp(patient_id)
**Purpose**: Archive patient with timestamp suffix  
**Created**: 2025-09-09  
**Logic**: Appends '_archived_YYYYMMDDHH24MISS' to patient_number

#### restore_archived_patient(patient_id)
**Purpose**: Restore archived patient
**Created**: 2025-09-09
**Logic**: Reverts to original_patient_number

### Schedule Management Functions

#### validate_schedule_resume(schedule_id, new_next_due_date)
**Purpose**: Validates schedule resume with new due date
**Created**: 2025-09-13
**Returns**: TABLE (is_valid boolean, error_message text, warnings text[])
**Logic**: Validates pause state, date constraints, and calculates missed executions

#### get_schedule_pause_statistics(schedule_id)
**Purpose**: Returns pause/resume analytics for schedules
**Created**: 2025-09-13
**Returns**: TABLE with pause counts, durations, and missed execution stats
**Usage**: Performance analysis and schedule management insights

### Core Functions

#### handle_new_user()
**Purpose**: Trigger function for user registration  
**Enhanced**: 2025-09-02 - Defaults to inactive/pending approval

#### calculate_next_due_date()
**Purpose**: Automatic next due date calculation  
**Updated**: 2025-09-02 - Uses interval_weeks

#### update_updated_at_column()
**Purpose**: Generic updated_at timestamp trigger

#### refresh_views()
**Purpose**: Manual view refresh for monitoring data

### Performance Functions

#### get_filtered_schedules(p_user_id, p_show_all, p_care_types, p_date_start, p_date_end)
**Purpose**: Server-side filtering with role-based access control
**Created**: 2025 | **Verified**: 2025-09-22
**Parameters**:
- `p_user_id` (UUID): User requesting data
- `p_show_all` (BOOLEAN, default FALSE): Bypass role restrictions
- `p_care_types` (TEXT[], optional): Filter by care types
- `p_date_start` (DATE, optional): Date range start
- `p_date_end` (DATE, optional): Date range end

**Returns**: Filtered schedule records with patient and item details
**Logic**:
- Admin role: Sees all data
- Doctor role: Sees only patients where doctor_id = user_id (unless show_all = true)
- Nurse role: Sees only patients matching nurse's care_type (unless show_all = true)
- show_all = TRUE bypasses role restrictions

#### get_filter_statistics(p_user_id)
**Purpose**: Get filter usage statistics for user

#### get_db_stats()
**Purpose**: Database statistics (admin only)

#### get_today_checklist(nurse_id)
**Purpose**: Today's due items for specific nurse

---

## Indexes

### Core Table Indexes

**profiles**:
- `idx_profiles_role` (role) - *not found in current DB*
- `idx_profiles_role_care_type` (role, care_type) WHERE role = 'nurse'
- `idx_profiles_id_role_care_type` (id, role, care_type)
- `idx_profiles_active_role_dept` (is_active, role, care_type) WHERE is_active = true
- `idx_profiles_role_department_active` (role, care_type, is_active)
- `idx_profiles_approved_by` (approved_by)

**patients**:
- `idx_patients_patient_number` (patient_number)
- `idx_patients_name` (name)
- `idx_patients_is_active` (is_active)
- `idx_patients_active` (is_active)
- `idx_patients_created_at` (created_at DESC)
- `idx_patients_created_by` (created_by)
- `idx_patients_care_type` (care_type)
- `idx_patients_care_type_active` (care_type) WHERE NOT archived
- `idx_patients_care_type_doctor` (care_type, doctor_id)
- `idx_patients_doctor_care_type` (doctor_id, care_type) WHERE doctor_id IS NOT NULL
- `idx_patients_doctor_id` (doctor_id)
- `idx_patients_archived` (archived, archived_at)
- `idx_patients_original_number` (original_patient_number)
- `unique_active_patient_number` (patient_number) WHERE is_active = true AND archived = false

**schedules**:
- `idx_schedules_patient` (patient_id)
- `idx_schedules_patient_id` (patient_id)
- `idx_schedules_item` (item_id)
- `idx_schedules_item_id` (item_id)
- `idx_schedules_nurse` (assigned_nurse_id) WHERE status = 'active'
- `idx_schedules_status` (status)
- `idx_schedules_status_date` (status, next_due_date)
- `idx_schedules_status_next_due` (status, next_due_date) WHERE status IN ('active', 'paused')
- `idx_schedules_next_due` (next_due_date) WHERE status = 'active'
- `idx_schedules_active_due_date` (status, next_due_date) WHERE status = 'active'
- `idx_schedules_notification` (next_due_date, requires_notification) WHERE status = 'active' AND requires_notification = true
- `idx_schedules_interval` (interval_weeks)
- `idx_schedules_composite` (patient_id, next_due_date, status)
- `idx_schedules_patient_status_date` (patient_id, status, next_due_date) WHERE status IN ('active', 'paused')
- `idx_schedules_created_by` (created_by)
- `idx_schedules_unique_active` (patient_id, item_id) WHERE status = 'active'

**schedule_executions**:
- `idx_executions_schedule` (schedule_id)
- `idx_executions_planned` (planned_date)
- `idx_executions_status` (status)
- `idx_executions_executed_by` (executed_by)

### Additional Indexes

- Various composite indexes for query optimization
- Conditional indexes for active records only
- Performance indexes with DESC ordering for recent data

---

## Row Level Security (RLS)

### Security Model Overview
**Major Overhaul**: 2025-09-02 - HIPAA-compliant security implementation

#### Core Security Principles
1. **No medical data access without approval**: All tables require `is_user_active_and_approved()` 
2. **Admin oversight**: Admins can manage users and system data
3. **Audit everything**: All operations are logged
4. **Fail secure**: Default deny, explicit allow

### RLS Policies by Table

#### profiles
- `profiles_secure_select`: Own profile OR admin
- `profiles_secure_insert`: Service role OR admin
- `profiles_secure_update`: Own profile (basic fields) OR admin (all fields)
- `profiles_secure_delete`: Admin only

#### patients
- `patients_secure_select`: Active approved users only
- `patients_secure_insert`: Active approved users only
- `patients_secure_update`: Active approved users only
- `patients_secure_delete`: Active approved users only
- `"Authenticated users can view archived patients for restoration"`: For archiving system

#### schedules
- `schedules_secure_select`: Active approved users only
- `schedules_secure_insert`: Active approved users only
- `schedules_secure_update`: Active approved users only
- `schedules_secure_delete`: Active approved users only

#### schedule_executions
- `executions_secure_select`: Active approved users only
- `executions_secure_insert`: Active approved users only
- `executions_secure_update`: Active approved users only
- `executions_secure_delete`: Active approved users only

#### items
- `items_secure_select`: Active approved users only
- `items_secure_insert`: Admin only
- `items_secure_update`: Admin only
- `items_secure_delete`: Admin only

#### notifications
- `notifications_secure_select`: Own notifications OR admin

#### audit_logs
- `"Admins can view audit logs"`: Admin only

### Removed Policies
**SECURITY CRITICAL**: All "allow all" policies were removed in 2025-09-02 migration:
- `*_allow_all_select`
- `*_allow_all_insert` 
- `*_allow_all_update`
- `*_allow_all_delete`

---

## Triggers

### Updated At Triggers
Applied to all major tables for automatic timestamp updates:
- `trigger_patients_updated_at`
- `trigger_items_updated_at`
- `trigger_schedules_updated_at`
- `trigger_executions_updated_at`
- `trigger_notifications_updated_at`

### Business Logic Triggers

#### trigger_calculate_next_due
**Table**: schedule_executions
**Purpose**: Automatically calculate next due date when execution is completed
**Enhanced**: 2025-09-02 - Uses interval_weeks

#### trigger_schedule_state_change
**Table**: schedules
**Purpose**: Handle schedule state transitions (pause/resume/cancel)
**Created**: 2025-09-13
**Current Implementation**: Simplified log-only trigger to prevent conflicts (2025-09-14)
**Note**: Application layer handles notifications/executions to avoid 409/23505 errors

#### on_auth_user_created
**Table**: auth.users  
**Purpose**: Create profile on user signup  
**Enhanced**: 2025-09-02 - Defaults to inactive/pending approval

### Audit Triggers

#### user_management_audit_trigger
**Table**: profiles  
**Purpose**: Log user approval/rejection actions

#### audit_profiles_trigger
**Table**: profiles  
**Purpose**: General profile change auditing

#### audit_schedules_trigger  
**Table**: patient_schedules (legacy)  
**Purpose**: Schedule change auditing

### Performance Triggers

#### trigger_schedule_changes
**Tables**: schedules  
**Purpose**: Handle schedule-related data changes

#### trigger_execution_changes
**Tables**: schedule_executions  
**Purpose**: Handle execution-related updates

---

## Data Types and Enums

### Custom Enums

```sql
-- User roles (UPDATED: doctor role added)
CREATE TYPE user_role AS ENUM ('nurse', 'admin', 'doctor');

-- Approval workflow
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Schedule statuses (includes 'deleted' in actual DB)
CREATE TYPE schedule_status AS ENUM ('active', 'paused', 'completed', 'deleted', 'cancelled');

-- Execution statuses
CREATE TYPE execution_status AS ENUM ('planned', 'completed', 'skipped', 'overdue');

-- Notification settings
CREATE TYPE notification_channel AS ENUM ('dashboard', 'push', 'email');
CREATE TYPE notification_state AS ENUM ('pending', 'ready', 'sent', 'failed', 'cancelled');

-- Legacy appointment types (patient_schedules table)
CREATE TYPE appointment_type AS ENUM ('consultation', 'treatment', 'follow_up', 'emergency', 'routine_check');
```

### Standard Types
- `uuid`: Primary keys, foreign keys
- `text`: Strings, names, notes
- `timestamptz`: All timestamps (timezone-aware)
- `date`: Date-only fields
- `time`: Time-only fields  
- `integer`: Numeric values, intervals
- `boolean`: Flags and status
- `jsonb`: Metadata and flexible data

---

## Security Considerations

### Access Control
1. **User Approval Workflow**: All new users must be approved by admin
2. **Medical Data Protection**: Zero access without approval + active status
3. **Admin Oversight**: Full administrative control with audit trails
4. **Self-Service Prevention**: Users cannot activate themselves

### Data Protection
1. **Patient Privacy**: Simplified patient data (no encryption for development)
2. **Audit Logging**: Comprehensive audit trails for all operations
3. **RLS Enforcement**: Database-level access control
4. **IP and User Agent Logging**: Full request context capture

### Archiving and Recovery
1. **Patient Archiving**: Prevents unique constraint conflicts
2. **Data Restoration**: Full restoration capability with original patient numbers
3. **Soft Deletion**: is_active flags prevent data loss

---

## Performance Considerations

### Query Optimization Functions
- **get_today_checklist**: Daily task retrieval
- **get_db_stats**: Database statistics monitoring
- **Enhanced search**: Patient search functionality

### Index Strategy
- **Composite indexes**: Multi-column query optimization
- **Conditional indexes**: Active record filtering
- **Timestamp indexes**: Recent data access patterns

---

## Migration History Summary

### Phase 1: Foundation (August 2025)
- Basic table creation (profiles, patient_schedules)
- Initial RLS setup
- Core care scheduler tables
- Simplified patient table structure

### Phase 2: Security & User Management (August-September 2025)
- User approval system implementation
- RLS policy enhancements
- Admin management functions
- Authentication system improvements

### Phase 3: Data Management (September 2025)
- Patient archiving and restoration system
- Schedule interval system (weeks-based)
- Enhanced constraint strategies
- Data integrity improvements

### Phase 4: Schedule Management & Conflict Resolution (September 13-14, 2025)
- **Schedule Pause/Resume System**: Complete workflow with state validation
- **Notification State Enhancement**: Added 'cancelled' state for proper lifecycle management
- **Unique Constraints**: Prevented duplicate notifications with partial unique indexes
- **Conflict Resolution**: Application-layer handling to avoid database conflicts
- **Analytics Functions**: Added pause statistics and resume validation functions
- **Trigger Simplification**: Moved complex logic to application layer for reliability

### Phase 5: Role-Based Filtering Enhancement (Before September 22, 2025)
- **Doctor Role Addition**: Added 'doctor' to user_role enum
- **Profile Enhancement**: Replaced department with care_type column
- **Patient Assignment**: Added doctor_id to patients table for doctor-patient relationships
- **Filtering Function**: Implemented get_filtered_schedules with role-based access control
- **Performance Indexes**: Added multiple indexes for filtering optimization
- **Materialized View**: dashboard_schedule_summary for performance

**Total Migrations**: 24+ applied migrations
**Current Status**: Production-ready with complete role-based filtering and schedule management
**Database Verification**: Direct verification performed on 2025-09-22

---

## TypeScript Integration

### Type Definition Files
1. **`/src/lib/database.types.ts`**: Main database types (outdated, missing core tables)
2. **`/src/types/database.types.ts`**: More complete types (dated 2025-08-18)

### Type Inconsistencies Identified
- Main database types file missing: `patients`, `schedules`, `schedule_executions`, `notifications`, `schedule_logs`
- Enum differences between files
- Patient table structure differences (encrypted vs. non-encrypted)

### Recommendations
1. Regenerate database types from current schema
2. Consolidate type definitions into single file
3. Update enum exports to match current schema
4. Add new archiving and approval fields to types

---

## Operational Notes

### Development vs. Production
- **Development**: Uses simplified patient table (no encryption)
- **Production**: Should implement proper encryption for patient data
- **API Keys**: Uses new Supabase API key system (not JWT tokens)

### Monitoring and Health
- **Database Health View**: Real-time system metrics
- **Performance Metrics**: Table sizes and statistics
- **Audit Logs**: Complete operation history
- **System Views**: Monitoring and diagnostic queries

### Backup and Recovery
- **Audit Logs**: Complete change history
- **Patient Archiving**: Handles unique constraint conflicts
- **Soft Deletion**: Preserves data integrity
- **Database Monitoring**: System health tracking

---

## Future Considerations

### Planned Enhancements
1. **Encryption**: Implement proper patient data encryption for production
2. **Multi-tenancy**: Hospital_id foreign key ready for multi-tenant setup
3. **Advanced Notifications**: Email and push notification implementation
4. **Enhanced Reporting**: Additional materialized views for reporting

### Technical Debt
1. **Type Definition Consolidation**: Unify and update TypeScript types
2. **Legacy Table Cleanup**: Remove or migrate patient_schedules table
3. **Function Optimization**: Review and optimize database functions
4. **Index Analysis**: Review index usage and optimize

---

**Document Version**: 2.0.0
**Schema Accuracy**: Directly verified against production database
**Last Verified**: September 22, 2025
**Verification Method**: Direct SQL queries against production database

*This document reflects the actual production database state as verified through direct database inspection on 2025-09-22. Major updates include:*
- *Doctor role implementation with patient assignment*
- *Profile care_type column (replacing department)*
- *Complete role-based filtering system with get_filtered_schedules function*
- *Dashboard optimization with materialized view*
- *Comprehensive index strategy for performance*