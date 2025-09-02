-- Fix trigger function to use interval_weeks instead of interval_days
-- This migration updates the calculate_next_due_date trigger to properly handle weeks-based intervals

-- Drop existing trigger to recreate with updated function
DROP TRIGGER IF EXISTS after_schedule_execution_insert_or_update ON schedule_executions;

-- Update the calculate_next_due_date function to use interval_weeks
CREATE OR REPLACE FUNCTION calculate_next_due_date()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule RECORD;
BEGIN
    -- Only process when execution is completed
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- Get the schedule details
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;
        
        -- Calculate next due date based on EXECUTED date (not planned date)
        -- Using interval_weeks * 7 days
        UPDATE schedules 
        SET 
            next_due_date = NEW.executed_date + (COALESCE(interval_weeks, 0) * 7 || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = now()
        WHERE id = NEW.schedule_id;
        
        -- Create notification for long-interval schedules (4 weeks or more)
        IF v_schedule.interval_weeks >= 4 AND v_schedule.requires_notification THEN
            INSERT INTO notifications (
                schedule_id,
                recipient_id,
                channel,
                notify_date,
                title,
                message
            ) VALUES (
                NEW.schedule_id,
                COALESCE(v_schedule.assigned_nurse_id, v_schedule.created_by),
                'dashboard'::notification_channel,
                (NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval - 
                 (v_schedule.notification_days_before || ' days')::interval)::date,
                '일정 알림',
                '예정된 일정이 ' || v_schedule.notification_days_before || '일 후 도래합니다.'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER after_schedule_execution_insert_or_update
AFTER INSERT OR UPDATE ON schedule_executions
FOR EACH ROW
EXECUTE FUNCTION calculate_next_due_date();

-- Add helpful comments
COMMENT ON FUNCTION calculate_next_due_date() IS 
'Automatically calculates next due date when a schedule is completed. 
Uses executed_date + (interval_weeks * 7) days for the calculation.
Also creates notifications for long-interval schedules.';