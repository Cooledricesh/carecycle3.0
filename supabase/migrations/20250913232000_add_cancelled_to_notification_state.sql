-- Add 'cancelled' value to notification_state enum
-- This fixes the 22P02 error when trying to set notification state to 'cancelled'

BEGIN;

-- Add 'cancelled' to the notification_state enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'cancelled' already exists in the enum
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'cancelled'
        AND enumtypid = (
            SELECT oid
            FROM pg_type
            WHERE typname = 'notification_state'
        )
    ) THEN
        -- Add the new value to the enum
        ALTER TYPE notification_state ADD VALUE IF NOT EXISTS 'cancelled';
    END IF;
END
$$;

-- Update the comment to reflect the new value
COMMENT ON TYPE notification_state IS 'Notification states: pending (대기중), ready (준비됨), sent (발송됨), failed (실패), cancelled (취소됨)';

COMMIT;