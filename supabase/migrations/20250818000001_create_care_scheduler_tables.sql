-- ============================================================================
-- 케어스케줄러 데이터베이스 스키마
-- Version: 1.0.0
-- Date: 2025-08-18
-- Description: 환자 반복 검사/주사 일정 관리 시스템
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

-- Drop existing types if they exist
DROP TYPE IF EXISTS schedule_status CASCADE;
DROP TYPE IF EXISTS execution_status CASCADE;
DROP TYPE IF EXISTS notification_channel CASCADE;
DROP TYPE IF EXISTS notification_state CASCADE;

-- 일정 상태
CREATE TYPE schedule_status AS ENUM (
    'active',     -- 활성
    'paused',     -- 일시중지
    'completed',  -- 완료
    'cancelled'   -- 취소
);

-- 실행 상태
CREATE TYPE execution_status AS ENUM (
    'planned',   -- 계획됨
    'completed', -- 완료
    'skipped',   -- 건너뜀
    'overdue'    -- 지연
);

-- 알림 채널
CREATE TYPE notification_channel AS ENUM (
    'dashboard', -- 대시보드
    'push',      -- 푸시 알림
    'email'      -- 이메일
);

-- 알림 상태
CREATE TYPE notification_state AS ENUM (
    'pending',  -- 대기중
    'ready',    -- 준비됨
    'sent',     -- 발송됨
    'failed'    -- 실패
);

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

-- 3.1 환자 정보 테이블
CREATE TABLE IF NOT EXISTS patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id uuid NULL, -- 향후 멀티테넌시 지원
    patient_number_encrypted bytea NOT NULL,
    name_encrypted bytea NOT NULL,
    name_search tsvector NULL,
    department text NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.2 검사/주사 항목 테이블
CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    category text NOT NULL CHECK (category IN ('검사', '주사', '처치', '기타')),
    default_interval_days integer DEFAULT 28 CHECK (default_interval_days > 0),
    -- Common intervals: 28 (4주), 56 (8주), 84 (12주), 168 (24주)
    description text NULL,
    instructions text NULL,
    preparation_notes text NULL,
    requires_notification boolean DEFAULT true,
    notification_days_before integer DEFAULT 7,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.3 반복 일정 정의 테이블
CREATE TABLE IF NOT EXISTS schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    interval_days integer NOT NULL CHECK (interval_days > 0),
    -- Common medical intervals: 28, 56, 84, 168 days
    start_date date NOT NULL,
    end_date date NULL,
    last_executed_date date NULL,
    next_due_date date NOT NULL,
    status schedule_status DEFAULT 'active',
    assigned_nurse_id uuid REFERENCES auth.users(id),
    notes text NULL,
    priority integer DEFAULT 0,
    -- Notification settings (only for longer intervals)
    requires_notification boolean DEFAULT false,
    notification_days_before integer DEFAULT 7 CHECK (notification_days_before >= 0),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- 제약조건
    CONSTRAINT check_end_date CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT check_next_due_date CHECK (next_due_date >= start_date),
    CONSTRAINT check_notification_interval CHECK (
        (interval_days <= 7 AND requires_notification = false) OR
        interval_days > 7
    )
);

-- 3.4 일정 실행 기록 테이블
CREATE TABLE IF NOT EXISTS schedule_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    planned_date date NOT NULL,
    executed_date date NULL,
    executed_time time NULL,
    status execution_status DEFAULT 'planned',
    executed_by uuid REFERENCES auth.users(id),
    notes text NULL,
    skipped_reason text NULL,
    is_rescheduled boolean DEFAULT false,
    original_date date NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- 제약조건
    CONSTRAINT unique_schedule_date UNIQUE (schedule_id, planned_date),
    CONSTRAINT check_execution_date CHECK (
        (status = 'completed' AND executed_date IS NOT NULL) OR
        (status != 'completed')
    )
);

-- 3.5 알림 테이블
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
    
    -- 제약조건
    CONSTRAINT check_notification_reference CHECK (
        schedule_id IS NOT NULL OR execution_id IS NOT NULL
    )
);

-- 3.6 일정 변경 이력 테이블
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
-- 4. INDEXES
-- ============================================================================

-- 환자 인덱스
CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital_id) WHERE hospital_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_department ON patients(department);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_patients_name_search ON patients USING gin(name_search);

-- 항목 인덱스
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_items_sort ON items(sort_order, name);

-- 일정 인덱스
CREATE INDEX IF NOT EXISTS idx_schedules_patient ON schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_schedules_item ON schedules(item_id);
CREATE INDEX IF NOT EXISTS idx_schedules_nurse ON schedules(assigned_nurse_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_due ON schedules(next_due_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_schedules_notification ON schedules(next_due_date, requires_notification) 
    WHERE status = 'active' AND requires_notification = true;

-- 실행 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_executions_planned ON schedule_executions(planned_date);
CREATE INDEX IF NOT EXISTS idx_executions_status ON schedule_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_executed_by ON schedule_executions(executed_by);

-- 알림 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_schedule ON notifications(schedule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_state ON notifications(state, notify_date);

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- 5.1 암호화 함수
CREATE OR REPLACE FUNCTION encrypt_text(plain_text text)
RETURNS bytea AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(plain_text, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data bytea)
RETURNS text AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
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
    IF NEW.status = 'completed' AND NEW.executed_date IS NOT NULL THEN
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
                'dashboard',
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
        NEW.name_search = to_tsvector('simple', decrypt_text(NEW.name_encrypted));
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
    WHERE s.status = 'active'
        AND s.next_due_date <= CURRENT_DATE
        AND (p_nurse_id IS NULL OR s.assigned_nurse_id = p_nurse_id)
    ORDER BY s.priority DESC, s.next_due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Updated_at 트리거
CREATE TRIGGER trigger_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_executions_updated_at BEFORE UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 다음 예정일 자동 계산 트리거
CREATE TRIGGER trigger_calculate_next_due AFTER INSERT OR UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION calculate_next_due_date();

-- 환자 검색 인덱스 트리거
CREATE TRIGGER trigger_patient_search BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_patient_search();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- RLS 활성화
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_logs ENABLE ROW LEVEL SECURITY;

-- 환자 정책
CREATE POLICY "Users can view all patients" ON patients
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert patients" ON patients
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update patients" ON patients
    FOR UPDATE 
    TO authenticated
    USING (true);

-- 항목 정책
CREATE POLICY "Users can view all items" ON items
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage items" ON items
    FOR ALL 
    TO authenticated
    USING (true);

-- 일정 정책
CREATE POLICY "Users can view all schedules" ON schedules
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage schedules" ON schedules
    FOR ALL 
    TO authenticated
    USING (true);

-- 실행 기록 정책
CREATE POLICY "Users can view all executions" ON schedule_executions
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage executions" ON schedule_executions
    FOR ALL 
    TO authenticated
    USING (true);

-- 알림 정책
CREATE POLICY "Users can view their notifications" ON notifications
    FOR SELECT 
    TO authenticated
    USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY "System can manage notifications" ON notifications
    FOR ALL 
    TO authenticated
    USING (true);

-- 로그 정책
CREATE POLICY "Users can view schedule logs" ON schedule_logs
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "System can insert logs" ON schedule_logs
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 8. INITIAL DATA (Optional)
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