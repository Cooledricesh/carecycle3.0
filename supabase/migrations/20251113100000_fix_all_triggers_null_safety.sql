-- Migration: Fix NULL safety in all triggers
-- Date: 2025-11-13
-- Purpose: Ensure all triggers handle NULL values safely (especially after user deletion)

-- 1. Fix calculate_next_due_date to handle NULL recipient_id
CREATE OR REPLACE FUNCTION "public"."calculate_next_due_date"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_schedule RECORD;
    v_recipient_id UUID;
BEGIN
    -- Only process when execution is completed
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- Get the schedule details including organization_id
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;

        -- Skip if schedule is not active
        IF v_schedule.status != 'active' THEN
            RAISE NOTICE 'Skipping next_due_date calculation for non-active schedule %', NEW.schedule_id;
            RETURN NEW;
        END IF;

        -- Calculate next due date based on EXECUTED date
        UPDATE schedules
        SET
            next_due_date = NEW.executed_date + (COALESCE(interval_weeks, 0) * 7 || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;

        -- Create notification for long-interval schedules
        IF v_schedule.interval_weeks >= 4 AND v_schedule.requires_notification THEN
            -- Validate organization_id exists
            IF v_schedule.organization_id IS NULL THEN
                RAISE WARNING 'Schedule % has no organization_id, skipping notification creation', NEW.schedule_id;
            ELSE
                -- 🔧 NULL SAFETY: Check recipient_id before INSERT
                v_recipient_id := COALESCE(v_schedule.assigned_nurse_id, v_schedule.created_by);

                IF v_recipient_id IS NOT NULL THEN
                    INSERT INTO notifications (
                        schedule_id,
                        recipient_id,
                        channel,
                        notify_date,
                        title,
                        message,
                        organization_id
                    ) VALUES (
                        NEW.schedule_id,
                        v_recipient_id,
                        'dashboard'::notification_channel,
                        (NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval -
                         (v_schedule.notification_days_before || ' days')::interval)::date,
                        '일정 알림',
                        format('예정된 일정이 %s일 후 도래합니다.', v_schedule.notification_days_before),
                        v_schedule.organization_id
                    ) ON CONFLICT DO NOTHING;
                ELSE
                    -- 🔧 NULL SAFETY: Log and skip notification creation
                    RAISE NOTICE 'Skipping notification creation - no valid recipient for schedule % (assigned_nurse_id and created_by are both NULL)', NEW.schedule_id;
                END IF;
            END IF;
        END IF;

        RAISE NOTICE 'Next due date updated for schedule %: %', NEW.schedule_id, NEW.executed_date + (v_schedule.interval_weeks * 7 || ' days')::interval;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Verify other triggers are NULL-safe
-- audit_table_changes already handles NULL user_id/email/name
-- capture_assignment_at_completion handles NULL doctor_id (it's nullable)
-- set_updated_at doesn't reference user fields

COMMENT ON FUNCTION public.calculate_next_due_date() IS
'Trigger function to calculate next due date after execution completion.
NULL-safe: Skips notification creation if no valid recipient exists.';
