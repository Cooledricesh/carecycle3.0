# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-12-25
- **Schedule Completion History Preservation**
  - Added database function `get_calendar_schedules` to retrieve both scheduled and completed items
  - Created performance indexes for calendar execution queries
  - Added `get_schedule_statistics` function for execution analytics
  - Created `calendar_monthly_summary` view for dashboard metrics
  - Implemented visual distinction for completed schedules in calendar view
  - Added new hook `useCalendarSchedules` for fetching calendar data with history
  - Completed schedules now show with gray background, strikethrough text, and check icon
  - Calendar cells display completed count separately from active schedules

### Technical Changes
- Migration: `20251225000001_add_schedule_history_support.sql`
- Modified: `scheduleService.ts` - Added `getCalendarSchedules` method
- Created: `useCalendarSchedules.ts` hook for calendar-specific data fetching
- Modified: `calendar-view.tsx` - Updated to use new calendar schedules hook
- Modified: `calendar-day-card.tsx` - Added visual styling for completed items

### Performance Improvements
- Added composite indexes for calendar date range queries
- Created covering index with included columns for execution history
- Optimized UNION queries with database function

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