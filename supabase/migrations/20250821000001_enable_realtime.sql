-- Enable real-time for tables that need synchronization
-- This allows clients to subscribe to changes and stay in sync

BEGIN;

-- Enable real-time for schedules table
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;

-- Enable real-time for schedule_executions table
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_executions;

-- Enable real-time for patients table
ALTER PUBLICATION supabase_realtime ADD TABLE patients;

-- Enable real-time for items table (optional, but useful)
ALTER PUBLICATION supabase_realtime ADD TABLE items;

COMMIT;

-- Note: Real-time respects RLS policies
-- Make sure authenticated users have SELECT permission on these tables