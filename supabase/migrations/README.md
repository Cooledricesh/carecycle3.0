# Supabase Migrations

## ⚠️ Documentation Location

**Single Source of Truth for Schema:** [/docs/db/dbschema.md](/docs/db/dbschema.md) (v3.0.0)

This directory contains SQL migration files that have been applied to the production database.

## Important References

- **Schema Documentation**: [/docs/db/dbschema.md](/docs/db/dbschema.md) - Complete schema reference (v3.0.0)
- **Migration History**: [/docs/db/migration-status.md](/docs/db/migration-status.md) - All 60 applied migrations
- **Baseline Reference**: [/supabase/schemas/baseline_20251105_reference.md](/supabase/schemas/baseline_20251105_reference.md) - Quick reference snapshot

## Active Migration Files

This directory contains **18 migration SQL files** that are currently in use. These files represent various stages of database schema evolution.

**Note**: Not all files in this directory are applied to production. See [migration-status.md](/docs/db/migration-status.md) for the definitive list of 60 applied migrations.

## Archive Directory

The `archive/` folder contains 76+ historical migration files organized by:

- **`deprecated/`** - Duplicate migrations, obsolete files, and failed attempts
- **`superseded/`** - Old migration versions replaced by newer ones
- **`experimental/`** - Test scripts and validation queries

These archived files are kept for historical reference only and **should not be applied**.

## Fresh Database Setup

**DO NOT** apply individual migration files manually. Instead:

### Recommended Approach: Use Supabase Dashboard Migration History

1. Your Supabase project already has **60 migrations applied**
2. For new environments, replicate using Supabase's built-in migration system
3. Refer to [dbschema.md](/docs/db/dbschema.md) for complete schema structure

### For Development Branches

If creating a new development branch:

```bash
# Use Supabase CLI to create a branch (copies schema from main)
supabase branches create <branch-name>
```

See Supabase documentation for branching and preview environments.

## Schema Components (Summary)

- **11 Tables**: profiles, patients, items, schedules, schedule_executions, notifications, schedule_logs, patient_schedules, audit_logs, user_preferences, query_performance_log
- **7 Enums**: user_role, approval_status, schedule_status, execution_status, notification_state, notification_channel, appointment_type
- **40+ Functions**: User management, schedule management, calendar functions, audit logging
- **42 RLS Policies**: Role-based access control (admin, doctor, nurse)

For detailed information on each component, see [/docs/db/dbschema.md](/docs/db/dbschema.md).

## Migration Best Practices

When creating new migrations:

1. **Naming Convention**: `YYYYMMDD######_description.sql` (unique timestamp required)
2. **Idempotency**: Use `IF NOT EXISTS` / `IF EXISTS` clauses
3. **Documentation**: Update [dbschema.md](/docs/db/dbschema.md) and [migration-status.md](/docs/db/migration-status.md)
4. **Testing**: Test on development branch before production
5. **Small Scope**: Keep migrations focused on single purpose

## Questions?

- Schema details → [/docs/db/dbschema.md](/docs/db/dbschema.md)
- Migration history → [/docs/db/migration-status.md](/docs/db/migration-status.md)
- Quick reference → [/supabase/schemas/baseline_20251105_reference.md](/supabase/schemas/baseline_20251105_reference.md)

---

**Last Updated**: November 5, 2025
**Migration Count**: 60 applied (production)
**Documentation Version**: Aligned with dbschema.md v3.0.0
