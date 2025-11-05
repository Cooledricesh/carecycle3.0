# Production Deployment Notes for FK Cascade Migrations

## Overview
These migrations add CASCADE DELETE to foreign key constraints to fix item deletion issues.
They are split into multiple steps to ensure production safety and minimize table locks.

## Migration Files (in order):
1. `00_pre_migration_validation.sql` - **RUN FIRST** - Validates data integrity (read-only)
2. `20250119_01_create_indexes_for_fk.sql` - Creates indexes for FK columns
3. `20250119_02_add_fk_not_valid.sql` - Adds FK constraints with NOT VALID
4. `20250119_03_validate_fk.sql` - Validates the constraints with orphan checks
5. `20250119_04_fix_schedule_trigger.sql` - Fixes trigger to only fire on UPDATE

## Production Deployment Steps:

### For Large Production Tables (Optional Enhanced Safety):

If your `schedules` and `schedule_logs` tables are very large (millions of rows),
consider this alternative approach:

#### Step 1: Create indexes concurrently (outside transaction)
```sql
-- Run these separately, not in a transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_item_id
ON schedules(item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_logs_schedule_id
ON schedule_logs(schedule_id);
```

#### Step 2: Apply the NOT VALID constraints
Run migration `20250119_02_add_fk_not_valid.sql` normally through Supabase.

#### Step 3: Validate during low traffic
During a maintenance window or low traffic period:
```sql
-- These can be run one at a time to minimize impact
ALTER TABLE schedules VALIDATE CONSTRAINT schedules_item_id_fkey;
ALTER TABLE schedule_logs VALIDATE CONSTRAINT schedule_logs_schedule_id_fkey;
```

#### Step 4: Apply trigger fix
Run migration `20250119_04_fix_schedule_trigger.sql` normally.

### For Normal Production Tables:
Simply apply all migrations in order through the Supabase dashboard.

## Why This Approach?

1. **NOT VALID constraints**: Allow adding FK without full table scan, only validates new/updated rows
2. **Separate validation**: Can be done during maintenance windows
3. **Index creation first**: Speeds up FK validation and cascade operations
4. **Trigger fix**: Prevents FK violations by not logging DELETE operations

## Lock Levels:
- `CREATE INDEX`: ShareLock (blocks writes)
- `CREATE INDEX CONCURRENTLY`: ShareUpdateExclusiveLock (allows reads and writes)
- `ADD CONSTRAINT NOT VALID`: ShareRowExclusiveLock (allows reads, blocks DDL)
- `VALIDATE CONSTRAINT`: ShareUpdateExclusiveLock (allows reads, blocks DDL)

## Monitoring:
Monitor for lock contention during deployment:
```sql
SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
ORDER BY query_start;
```

## Rollback Plan:
If issues occur, rollback by:
1. Dropping the new constraints
2. Recreating old constraints without CASCADE
3. Reverting the trigger to fire on UPDATE OR DELETE

```sql
-- Emergency rollback
ALTER TABLE schedules DROP CONSTRAINT schedules_item_id_fkey;
ALTER TABLE schedules ADD CONSTRAINT schedules_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES items(id);

ALTER TABLE schedule_logs DROP CONSTRAINT schedule_logs_schedule_id_fkey;
ALTER TABLE schedule_logs ADD CONSTRAINT schedule_logs_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES schedules(id);

-- Restore old trigger
DROP TRIGGER IF EXISTS trigger_log_schedule_changes ON schedules;
CREATE TRIGGER trigger_log_schedule_changes
    AFTER UPDATE OR DELETE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION log_schedule_changes();
```