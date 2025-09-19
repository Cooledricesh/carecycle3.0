-- Fix item deletion by changing foreign key constraint to CASCADE
ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_item_id_fkey;

ALTER TABLE schedules
ADD CONSTRAINT schedules_item_id_fkey
FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

-- Fix schedule_logs foreign key as well
ALTER TABLE schedule_logs
DROP CONSTRAINT IF EXISTS schedule_logs_schedule_id_fkey;

ALTER TABLE schedule_logs
ADD CONSTRAINT schedule_logs_schedule_id_fkey
FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;