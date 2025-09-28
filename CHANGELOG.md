# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-09-25
- **Expanded Doctor Assignment Permissions**
  - Doctor and nurse roles can now update patient doctor assignments (previously admin-only)
  - Added dedicated API endpoint `/api/patients/[id]/update-doctor` with role-based authorization
  - Implemented database function `update_patient_doctor_assignment()` for secure doctor assignment updates
  - Added comprehensive error handling and logging for doctor assignment operations
  - Consolidated conflicting RLS policies into unified policies per operation type

- **Enhanced Schedule Tracking and Filtering**
  - Added doctor and care type assignment history tracking in schedules
  - Improved calendar views with assignment context
  - Enhanced filter strategies for admin, doctor, and nurse roles

### Technical Changes
- **Database Migrations:**
  - `20250925000001_allow_doctor_nurse_update_doctor_id.sql` - Initial RLS policy update for doctor/nurse permissions
  - `20250925000002_fix_conflicting_update_policies.sql` - Resolved PostgreSQL 42P17 error by consolidating all RLS policies
  - `20250925000003_alternative_function_based_update.sql` - Added secure functions for patient updates
  - `20251225000001_add_schedule_history_support.sql` - Added schedule completion history support
  - `20251227000001_add_assignment_tracking.sql` - Added assignment tracking fields
  - `20251227000002_fix_function_return_type.sql` - Fixed function return types

- **API Routes:**
  - Created: `src/app/api/patients/[id]/update-doctor/route.ts` - Dedicated doctor assignment endpoint
  - Modified: `src/app/api/patients/[id]/update/route.ts` - Updated general patient update handler

- **Services & Components:**
  - Modified: `src/services/filters/AdminFilterStrategy.ts` - Enhanced admin filtering logic
  - Modified: `src/services/filters/DoctorFilterStrategy.ts` - Updated doctor role filtering
  - Modified: `src/services/filters/NurseFilterStrategy.ts` - Refined nurse role filtering
  - Modified: `src/services/scheduleService.ts` - Added calendar schedules method
  - Modified: `src/services/scheduleServiceEnhanced.ts` - Enhanced schedule service capabilities
  - Modified: `src/components/calendar/calendar-view.tsx` - Improved calendar display
  - Modified: `src/components/calendar/calendar-day-card.tsx` - Enhanced day card rendering
  - Created: `src/hooks/useCalendarSchedules.ts` - New hook for calendar data fetching

- **Documentation:**
  - Created: `CRITICAL_ISSUE_ANALYSIS.md` - Complete analysis of RLS policy conflicts and solutions
  - Created: `test-rls-policies.sql` - Test suite for verifying RLS policy behavior

### Security Improvements
- Unified RLS policies to eliminate policy conflicts and PostgreSQL 42P17 errors
- Implemented SECURITY DEFINER functions with proper role validation
- Added comprehensive audit logging for doctor assignment changes
- Enhanced error handling with detailed logging for debugging

## [0.5.0] - 2025-09-22

### Added
- Doctor role support with patient assignment
- Role-based filtering for schedules
- Care type filtering for nurses
- Doctor-patient relationship management
- Performance monitoring dashboard at `/debug`

## [0.4.0] - 2025-09-14

### Added
- Schedule pause/resume functionality
- Notification conflict resolution
- Schedule state validation functions
- Pause statistics analytics

## [0.3.0] - 2025-09-09

### Added
- Patient archiving system
- Archive restoration functionality
- Unique patient number constraints with archive support

## [0.2.0] - 2025-09-02

### Added
- User approval workflow system
- Enhanced RLS policies for HIPAA compliance
- Admin management functions
- Comprehensive audit logging

## [0.1.0] - 2025-08-18

### Added
- Initial release
- Basic patient management
- Schedule creation and tracking
- Daily checklist functionality
- Real-time synchronization
- Dashboard interface