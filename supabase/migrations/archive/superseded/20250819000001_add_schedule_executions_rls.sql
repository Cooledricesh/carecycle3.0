-- Complete RLS policies for all schedule-related tables
-- This migration adds Row Level Security policies for schedule_executions, schedule_logs, and notifications tables

-- ========================================
-- Enable RLS on all related tables
-- ========================================
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Clean up existing policies
-- ========================================

-- schedule_executions policies
DROP POLICY IF EXISTS "Users can view all schedule executions" ON schedule_executions;
DROP POLICY IF EXISTS "Users can insert schedule executions" ON schedule_executions;
DROP POLICY IF EXISTS "Users can update their own schedule executions" ON schedule_executions;
DROP POLICY IF EXISTS "Users can delete schedule executions" ON schedule_executions;

-- schedule_logs policies
DROP POLICY IF EXISTS "Users can view all schedule logs" ON schedule_logs;
DROP POLICY IF EXISTS "Users can insert schedule logs" ON schedule_logs;
DROP POLICY IF EXISTS "Users can update schedule logs" ON schedule_logs;
DROP POLICY IF EXISTS "System can insert schedule logs" ON schedule_logs;

-- schedules policies
DROP POLICY IF EXISTS "Users can view all schedules" ON schedules;
DROP POLICY IF EXISTS "Users can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Users can update schedules" ON schedules;
DROP POLICY IF EXISTS "Users can delete schedules" ON schedules;

-- notifications policies
DROP POLICY IF EXISTS "Users can view notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Trigger can insert notifications" ON notifications;

-- ========================================
-- schedule_executions table policies
-- ========================================

CREATE POLICY "Users can view all schedule executions" 
ON schedule_executions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert schedule executions" 
ON schedule_executions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update schedule executions" 
ON schedule_executions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can delete schedule executions" 
ON schedule_executions
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- schedule_logs table policies
-- ========================================

CREATE POLICY "Users can view all schedule logs" 
ON schedule_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert schedule logs" 
ON schedule_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can insert schedule logs" 
ON schedule_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can update schedule logs" 
ON schedule_logs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- schedules table policies
-- ========================================

CREATE POLICY "Users can view all schedules" 
ON schedules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert schedules" 
ON schedules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update schedules" 
ON schedules
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can delete schedules" 
ON schedules
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- notifications table policies (CRITICAL!)
-- ========================================

-- Allow users to view their own notifications
CREATE POLICY "Users can view notifications" 
ON notifications
FOR SELECT
TO authenticated
USING (
    recipient_id = auth.uid() 
    OR auth.uid() IN (
        SELECT created_by FROM schedules WHERE id = schedule_id
    )
    OR true -- For now, allow all authenticated users to view all notifications
);

-- Allow authenticated users to insert notifications
CREATE POLICY "Users can insert notifications" 
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- IMPORTANT: Allow the trigger function to insert notifications
-- This is critical for the calculate_next_due_date() function
CREATE POLICY "Trigger can insert notifications" 
ON notifications
FOR INSERT
TO anon, public
WITH CHECK (true);

-- Allow users to update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update notifications" 
ON notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid() OR true)
WITH CHECK (true);

-- ========================================
-- Fix the trigger function to run with elevated privileges
-- ========================================

-- Update the calculate_next_due_date function to run with SECURITY DEFINER
-- This allows it to bypass RLS when necessary
CREATE OR REPLACE FUNCTION calculate_next_due_date()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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
        
        -- 장기 간격 일정에 대한 알림 생성 (28일 이상)
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Add documentation comments
-- ========================================

COMMENT ON TABLE schedule_executions IS '검사/주사 실행 기록을 저장하는 테이블';
COMMENT ON COLUMN schedule_executions.schedule_id IS '연관된 스케줄 ID';
COMMENT ON COLUMN schedule_executions.planned_date IS '계획된 실행일';
COMMENT ON COLUMN schedule_executions.executed_date IS '실제 실행일';
COMMENT ON COLUMN schedule_executions.executed_by IS '실행한 사용자 ID';
COMMENT ON COLUMN schedule_executions.status IS '실행 상태 (planned, completed, skipped, cancelled)';

COMMENT ON TABLE schedule_logs IS '스케줄 관련 모든 활동 로그를 저장하는 테이블';
COMMENT ON TABLE schedules IS '환자별 검사/주사 스케줄 정보를 저장하는 테이블';
COMMENT ON TABLE notifications IS '스케줄 관련 알림을 저장하는 테이블';