-- Step 3: Validate the constraints in a separate transaction
-- This validates existing data against the constraint
-- In production, this can be run during low-traffic periods
-- The validation acquires a SHARE UPDATE EXCLUSIVE lock which allows reads but blocks DDL

DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    -- Check for orphaned records in schedules.item_id
    SELECT COUNT(*) INTO orphan_count
    FROM schedules s
    LEFT JOIN items i ON s.item_id = i.id
    WHERE s.item_id IS NOT NULL AND i.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphaned records in schedules.item_id. These will prevent validation.', orphan_count;
        -- In production, you might want to:
        -- DELETE FROM schedules WHERE item_id NOT IN (SELECT id FROM items);
        -- or
        -- UPDATE schedules SET item_id = NULL WHERE item_id NOT IN (SELECT id FROM items);
        RAISE EXCEPTION 'Cannot validate constraint with orphaned records. Clean data first.';
    END IF;

    -- Check for orphaned records in schedule_logs.schedule_id
    SELECT COUNT(*) INTO orphan_count
    FROM schedule_logs sl
    LEFT JOIN schedules s ON sl.schedule_id = s.id
    WHERE sl.schedule_id IS NOT NULL AND s.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphaned records in schedule_logs.schedule_id. These will prevent validation.', orphan_count;
        -- In production, you might want to:
        -- DELETE FROM schedule_logs WHERE schedule_id NOT IN (SELECT id FROM schedules);
        RAISE EXCEPTION 'Cannot validate constraint with orphaned records. Clean data first.';
    END IF;

    -- Set statement timeout to prevent indefinite blocking
    -- Adjust based on table size (10 minutes should be enough for most cases)
    SET LOCAL statement_timeout = '10min';

    -- Validate constraints
    RAISE NOTICE 'Validating schedules_item_id_fkey...';
    ALTER TABLE schedules VALIDATE CONSTRAINT schedules_item_id_fkey;
    RAISE NOTICE 'Successfully validated schedules_item_id_fkey';

    RAISE NOTICE 'Validating schedule_logs_schedule_id_fkey...';
    ALTER TABLE schedule_logs VALIDATE CONSTRAINT schedule_logs_schedule_id_fkey;
    RAISE NOTICE 'Successfully validated schedule_logs_schedule_id_fkey';

    -- Reset timeout
    RESET statement_timeout;

EXCEPTION
    WHEN OTHERS THEN
        RESET statement_timeout;
        RAISE EXCEPTION 'Failed to validate constraints: %', SQLERRM;
END $$;