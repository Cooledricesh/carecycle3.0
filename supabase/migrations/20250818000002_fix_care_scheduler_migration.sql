-- ============================================================================
-- 케어스케줄러 마이그레이션 수정
-- Version: 1.0.1
-- Date: 2025-08-18
-- Description: 기존 테이블과 인덱스를 고려한 안전한 마이그레이션
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS (이미 존재해도 안전)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. 누락된 테이블만 생성
-- ============================================================================

-- notifications 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
    execution_id uuid REFERENCES schedule_executions(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES auth.users(id),
    channel notification_channel NOT NULL,
    notify_date date NOT NULL,
    notify_time time DEFAULT '09:00',
    state notification_state DEFAULT 'pending',
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}',
    sent_at timestamptz NULL,
    error_message text NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT check_notification_reference CHECK (
        schedule_id IS NOT NULL OR execution_id IS NOT NULL
    )
);

-- schedule_logs 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS schedule_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    action text NOT NULL,
    old_values jsonb NULL,
    new_values jsonb NULL,
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now(),
    reason text NULL
);

-- ============================================================================
-- 3. 누락된 인덱스만 생성 (DROP & CREATE 방식)
-- ============================================================================

-- 기존 인덱스 삭제 후 재생성 (WHERE 절 문법 통일)
DROP INDEX IF EXISTS idx_schedules_notification;
CREATE INDEX idx_schedules_notification ON schedules(next_due_date, requires_notification) 
    WHERE status = 'active'::schedule_status AND requires_notification = true;

-- notifications 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_schedule ON notifications(schedule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_state ON notifications(state, notify_date);

-- ============================================================================
-- 4. FUNCTIONS (CREATE OR REPLACE로 안전하게)
-- ============================================================================

-- 5.1 암호화 함수
CREATE OR REPLACE FUNCTION encrypt_text(plain_text text)
RETURNS bytea AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    -- app.encryption_key 설정이 없으면 기본값 사용
    BEGIN
        RETURN pgp_sym_encrypt(plain_text, current_setting('app.encryption_key'));
    EXCEPTION
        WHEN undefined_object THEN
            -- 개발 환경용 기본 키 (프로덕션에서는 반드시 변경)
            RETURN pgp_sym_encrypt(plain_text, 'default_dev_key_change_in_production');
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data bytea)
RETURNS text AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    BEGIN
        RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
    EXCEPTION
        WHEN undefined_object THEN
            RETURN pgp_sym_decrypt(encrypted_data, 'default_dev_key_change_in_production');
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Updated_at 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.3 다음 예정일 자동 계산 함수
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

-- 5.4 환자 이름 검색 인덱스 업데이트 함수
CREATE OR REPLACE FUNCTION update_patient_search()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name_encrypted IS NOT NULL THEN
        BEGIN
            NEW.name_search = to_tsvector('simple', decrypt_text(NEW.name_encrypted));
        EXCEPTION
            WHEN OTHERS THEN
                -- 복호화 실패 시 NULL 유지
                NEW.name_search = NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.5 오늘의 체크리스트 조회 함수
CREATE OR REPLACE FUNCTION get_today_checklist(p_nurse_id uuid DEFAULT NULL)
RETURNS TABLE (
    schedule_id uuid,
    patient_name text,
    patient_number text,
    item_name text,
    item_category text,
    next_due_date date,
    interval_days integer,
    priority integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as schedule_id,
        decrypt_text(p.name_encrypted) as patient_name,
        decrypt_text(p.patient_number_encrypted) as patient_number,
        i.name as item_name,
        i.category as item_category,
        s.next_due_date,
        s.interval_days,
        s.priority
    FROM schedules s
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    WHERE s.status = 'active'::schedule_status
        AND s.next_due_date <= CURRENT_DATE
        AND (p_nurse_id IS NULL OR s.assigned_nurse_id = p_nurse_id)
    ORDER BY s.priority DESC, s.next_due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. TRIGGERS (DROP & CREATE로 안전하게)
-- ============================================================================

-- Updated_at 트리거
DROP TRIGGER IF EXISTS trigger_patients_updated_at ON patients;
CREATE TRIGGER trigger_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_items_updated_at ON items;
CREATE TRIGGER trigger_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_schedules_updated_at ON schedules;
CREATE TRIGGER trigger_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_executions_updated_at ON schedule_executions;
CREATE TRIGGER trigger_executions_updated_at BEFORE UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 다음 예정일 자동 계산 트리거
DROP TRIGGER IF EXISTS trigger_calculate_next_due ON schedule_executions;
CREATE TRIGGER trigger_calculate_next_due AFTER INSERT OR UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION calculate_next_due_date();

-- 환자 검색 인덱스 트리거
DROP TRIGGER IF EXISTS trigger_patient_search ON patients;
CREATE TRIGGER trigger_patient_search BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_patient_search();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (이미 활성화된 경우 무시)
-- ============================================================================

-- RLS 활성화 (이미 활성화되어 있으면 에러 없음)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책은 이미 존재하므로 생략 (필요시 별도 마이그레이션으로 처리)

-- ============================================================================
-- 8. 초기 데이터 (이미 존재하면 무시)
-- ============================================================================

-- 정신과 기본 항목 추가
INSERT INTO items (code, name, category, default_interval_days, requires_notification, notification_days_before, sort_order)
VALUES 
    -- 장기지속형 항정신병 주사제
    ('INJ001', '인베가 서스티나', '주사', 28, true, 7, 10),      -- 4주 간격
    ('INJ002', '인베가 트린자', '주사', 84, true, 14, 20),       -- 12주 간격
    ('INJ003', '인베가 하피에라', '주사', 168, true, 21, 30),    -- 24주 간격 (6개월)
    ('INJ004', '아빌리파이 메인테나', '주사', 28, true, 7, 40),  -- 4주 간격
    ('INJ005', '아빌리파이 아심투파이', '주사', 56, true, 10, 50), -- 8주 간격
    
    -- 정신과 검사
    ('PSY001', '심리검사', '검사', 84, true, 14, 60),           -- 12주 간격
    ('PSY002', 'QEEG 검사', '검사', 168, true, 21, 70)          -- 24주 간격
ON CONFLICT (code) DO NOTHING;

COMMIT;