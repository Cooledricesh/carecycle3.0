-- Step 2: Add foreign key constraints with NOT VALID to avoid full table scan
-- This allows adding the constraint immediately without locking the table

DO $$
BEGIN
    -- Verify that referenced tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'items') THEN
        RAISE EXCEPTION 'Table "items" does not exist';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'schedules') THEN
        RAISE EXCEPTION 'Table "schedules" does not exist';
    END IF;

    -- Drop existing constraints if they exist
    ALTER TABLE schedules
    DROP CONSTRAINT IF EXISTS schedules_item_id_fkey;

    ALTER TABLE schedule_logs
    DROP CONSTRAINT IF EXISTS schedule_logs_schedule_id_fkey;

    -- Add new constraints with CASCADE and NOT VALID
    -- NOT VALID means the constraint applies only to new/modified rows
    ALTER TABLE schedules
    ADD CONSTRAINT schedules_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE NOT VALID;

    RAISE NOTICE 'Added NOT VALID constraint schedules_item_id_fkey';

    ALTER TABLE schedule_logs
    ADD CONSTRAINT schedule_logs_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE NOT VALID;

    RAISE NOTICE 'Added NOT VALID constraint schedule_logs_schedule_id_fkey';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to add FK constraints: %', SQLERRM;
END $$;