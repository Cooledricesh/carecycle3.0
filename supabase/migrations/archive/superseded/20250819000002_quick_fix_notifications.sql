-- Quick fix: Temporarily adjust the trigger to avoid notification creation
-- This is a temporary solution for testing

-- Option 1: Disable the trigger temporarily
-- ALTER TABLE schedule_executions DISABLE TRIGGER trigger_calculate_next_due;

-- Option 2: Modify the function to skip notification creation
CREATE OR REPLACE FUNCTION calculate_next_due_date()
RETURNS TRIGGER AS $$
DECLARE
    v_schedule RECORD;
BEGIN
    -- 실행이 완료된 경우에만 처리
    IF NEW.status = 'completed'::execution_status AND NEW.executed_date IS NOT NULL THEN
        -- 해당 일정 조회
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;
        
        -- 다음 예정일 계산 (interval_days를 일 단위로 추가)
        UPDATE schedules 
        SET 
            next_due_date = NEW.executed_date + (interval_days || ' days')::interval,
            last_executed_date = NEW.executed_date,
            updated_at = now()
        WHERE id = NEW.schedule_id;
        
        -- 알림 생성 부분을 임시로 주석 처리
        -- 나중에 알림 기능이 필요할 때 활성화
        /*
        IF v_schedule.interval_days >= 28 AND v_schedule.requires_notification THEN
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
                (NEW.executed_date + (v_schedule.interval_days || ' days')::interval - 
                 (v_schedule.notification_days_before || ' days')::interval)::date,
                '일정 알림',
                '예정된 일정이 ' || v_schedule.notification_days_before || '일 후 도래합니다.'
            );
        END IF;
        */
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;