-- Step 1: Create indexes for foreign key columns if they don't exist
-- These indexes help with FK validation and cascade operations
-- Note: CONCURRENTLY can't be used inside transactions, so we use regular CREATE INDEX
-- For production with large tables, run these commands separately with CONCURRENTLY

-- Check and create index for schedules.item_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'schedules'
        AND indexname = 'idx_schedules_item_id'
    ) THEN
        -- Note: In production with large tables, run separately:
        -- CREATE INDEX CONCURRENTLY idx_schedules_item_id ON schedules(item_id);
        CREATE INDEX idx_schedules_item_id ON schedules(item_id);
        RAISE NOTICE 'Created index idx_schedules_item_id';
    ELSE
        RAISE NOTICE 'Index idx_schedules_item_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create index idx_schedules_item_id: %', SQLERRM;
END $$;

-- Check and create index for schedule_logs.schedule_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'schedule_logs'
        AND indexname = 'idx_schedule_logs_schedule_id'
    ) THEN
        -- Note: In production with large tables, run separately:
        -- CREATE INDEX CONCURRENTLY idx_schedule_logs_schedule_id ON schedule_logs(schedule_id);
        CREATE INDEX idx_schedule_logs_schedule_id ON schedule_logs(schedule_id);
        RAISE NOTICE 'Created index idx_schedule_logs_schedule_id';
    ELSE
        RAISE NOTICE 'Index idx_schedule_logs_schedule_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create index idx_schedule_logs_schedule_id: %', SQLERRM;
END $$;