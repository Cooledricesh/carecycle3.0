-- ============================================================================
-- 케어스케줄러 목표 스키마 DDL
-- Version: 1.0.0
-- Date: 2025-08-18
-- Description: PRD 요구사항 충족을 위한 데이터베이스 스키마
-- 
-- IMPORTANT: This schema is idempotent and can be run multiple times safely.
-- It will drop and recreate enum types and use CREATE TABLE IF NOT EXISTS.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

-- Drop existing types if they exist (CASCADE to handle dependencies)
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

-- 3.0 프로필 테이블 (Supabase Auth 보완)
-- Note: This table is typically created by Supabase Auth, but we ensure it exists
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    role text CHECK (role IN ('nurse', 'admin', 'user')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.1 환자 정보 테이블
CREATE TABLE IF NOT EXISTS patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id uuid NULL, -- 향후 멀티테넌시 지원
    patient_number_encrypted bytea NOT NULL,
    name_encrypted bytea NOT NULL,
    name_search tsvector NULL, -- Will be updated via trigger
    department text NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_by uuid REFERENCES profiles(id),
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
    assigned_nurse_id uuid REFERENCES profiles(id),
    notes text NULL,
    priority integer DEFAULT 0,
    -- Notification settings (only for longer intervals)
    requires_notification boolean DEFAULT false,
    notification_days_before integer DEFAULT 7 CHECK (notification_days_before >= 0),
    created_by uuid REFERENCES profiles(id),
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
    executed_by uuid REFERENCES profiles(id),
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
    recipient_id uuid NOT NULL REFERENCES profiles(id),
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
    changed_by uuid REFERENCES profiles(id),
    changed_at timestamptz DEFAULT now(),
    reason text NULL
);

-- ============================================================================
-- 4. SECURITY FUNCTIONS
-- ============================================================================

-- 암호화 키 가져오기
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.encryption_key', true),
        'default-encryption-key-change-in-production'
    );
END;
$$;

-- 환자 정보 암호화
CREATE OR REPLACE FUNCTION encrypt_patient_data(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(plain_text, get_encryption_key());
END;
$$;

-- 환자 정보 복호화
CREATE OR REPLACE FUNCTION decrypt_patient_data(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE  -- Mark as STABLE since it depends on configuration
AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_decrypt(encrypted_data, get_encryption_key());
END;
$$;

-- ============================================================================
-- 5. AUTOMATION FUNCTIONS
-- ============================================================================

-- 다음 예정일 계산 함수 (단순화된 일 단위 계산)
CREATE OR REPLACE FUNCTION calculate_next_due_date(
    p_interval_days integer,
    p_reference_date date
)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
    -- Simple day-based interval calculation
    RETURN p_reference_date + (p_interval_days || ' days')::interval;
END;
$$;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- name_search 컬럼 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_patient_name_search()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- name_encrypted가 변경되었을 때 name_search 업데이트
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.name_encrypted IS DISTINCT FROM OLD.name_encrypted) THEN
        NEW.name_search := to_tsvector('simple', 
            COALESCE(
                decrypt_patient_data(NEW.name_encrypted),
                ''
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- updated_at 트리거 생성 (DROP IF EXISTS for idempotency)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- patients 테이블에 name_search 업데이트 트리거 추가
DROP TRIGGER IF EXISTS update_patient_name_search_trigger ON patients;
CREATE TRIGGER update_patient_name_search_trigger BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_patient_name_search();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_executions_updated_at ON schedule_executions;
CREATE TRIGGER update_schedule_executions_updated_at BEFORE UPDATE ON schedule_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 일정 실행 후 다음 예정일 업데이트 트리거
CREATE OR REPLACE FUNCTION update_next_due_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_schedule schedules%ROWTYPE;
BEGIN
    -- 실행 완료 시에만 처리
    IF NEW.status = 'completed' AND NEW.executed_date IS NOT NULL THEN
        -- 일정 정보 조회
        SELECT * INTO v_schedule FROM schedules WHERE id = NEW.schedule_id;
        
        -- 다음 예정일 업데이트
        UPDATE schedules
        SET 
            last_executed_date = NEW.executed_date,
            next_due_date = calculate_next_due_date(
                v_schedule.interval_days, 
                NEW.executed_date
            ),
            updated_at = now()
        WHERE id = NEW.schedule_id;
        
        -- 다음 실행 계획 자동 생성
        INSERT INTO schedule_executions (
            schedule_id, 
            planned_date, 
            status
        )
        SELECT 
            NEW.schedule_id,
            calculate_next_due_date(
                v_schedule.interval_days, 
                NEW.executed_date
            ),
            'planned'
        ON CONFLICT (schedule_id, planned_date) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_next_due_date ON schedule_executions;
CREATE TRIGGER trigger_update_next_due_date
AFTER UPDATE OF status, executed_date ON schedule_executions
FOR EACH ROW
EXECUTE FUNCTION update_next_due_date();

-- 알림 생성 트리거 (장기 간격 일정만)
CREATE OR REPLACE FUNCTION create_schedule_notifications()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- 알림이 필요한 활성 일정에 대해서만 알림 생성
    IF NEW.status = 'active' AND NEW.requires_notification = true THEN
        -- 기존 대기중 알림 삭제
        DELETE FROM notifications 
        WHERE schedule_id = NEW.id 
        AND state = 'pending';
        
        -- 새 알림 생성 (예정일 N일 전, 28일 이상 간격만)
        IF NEW.interval_days >= 28 AND 
           NEW.next_due_date - CURRENT_DATE <= NEW.notification_days_before THEN
            INSERT INTO notifications (
                schedule_id,
                recipient_id,
                channel,
                notify_date,
                title,
                message
            )
            VALUES (
                NEW.id,
                COALESCE(NEW.assigned_nurse_id, NEW.created_by),
                'dashboard',
                GREATEST(CURRENT_DATE, NEW.next_due_date - NEW.notification_days_before),
                '일정 알림',
                format('환자 일정이 %s에 예정되어 있습니다. (간격: %s일)', 
                       NEW.next_due_date, NEW.interval_days)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_notifications ON schedules;
CREATE TRIGGER trigger_create_notifications
AFTER INSERT OR UPDATE OF next_due_date, status, requires_notification, notification_days_before ON schedules
FOR EACH ROW
EXECUTE FUNCTION create_schedule_notifications();

-- 일정 변경 로그 트리거
CREATE OR REPLACE FUNCTION log_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO schedule_logs (
            schedule_id,
            action,
            old_values,
            new_values,
            changed_by
        )
        VALUES (
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            auth.uid()
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO schedule_logs (
            schedule_id,
            action,
            old_values,
            changed_by
        )
        VALUES (
            OLD.id,
            'DELETE',
            to_jsonb(OLD),
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_schedule_changes ON schedules;
CREATE TRIGGER trigger_log_schedule_changes
AFTER UPDATE OR DELETE ON schedules
FOR EACH ROW
EXECUTE FUNCTION log_schedule_changes();

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- 환자 정보 보안 뷰
CREATE OR REPLACE VIEW patients_secure AS
SELECT 
    id,
    hospital_id,
    decrypt_patient_data(patient_number_encrypted) AS patient_number,
    decrypt_patient_data(name_encrypted) AS name,
    department,
    is_active,
    metadata,
    created_by,
    created_at,
    updated_at
FROM patients;

-- 오늘의 체크리스트 뷰
CREATE OR REPLACE VIEW today_checklist AS
SELECT 
    se.id AS execution_id,
    s.id AS schedule_id,
    p.id AS patient_id,
    decrypt_patient_data(p.name_encrypted) AS patient_name,
    decrypt_patient_data(p.patient_number_encrypted) AS patient_number,
    p.department,
    i.name AS item_name,
    i.category AS item_category,
    i.instructions,
    se.planned_date,
    se.executed_date,
    se.executed_time,
    se.status AS execution_status,
    s.assigned_nurse_id,
    nurse.name AS assigned_nurse_name,
    s.notes AS schedule_notes,
    se.notes AS execution_notes,
    s.priority
FROM schedule_executions se
JOIN schedules s ON se.schedule_id = s.id
JOIN patients p ON s.patient_id = p.id
JOIN items i ON s.item_id = i.id
LEFT JOIN profiles nurse ON s.assigned_nurse_id = nurse.id
WHERE se.planned_date = CURRENT_DATE
    AND s.status = 'active'
    AND se.status IN ('planned', 'overdue')
ORDER BY 
    s.priority DESC,
    p.department,
    i.sort_order;

-- 대시보드 요약 뷰
CREATE OR REPLACE VIEW dashboard_summary AS
WITH today_stats AS (
    SELECT
        COUNT(*) FILTER (WHERE se.status = 'completed') AS completed_count,
        COUNT(*) FILTER (WHERE se.status = 'planned') AS planned_count,
        COUNT(*) FILTER (WHERE se.status = 'overdue') AS overdue_count,
        COUNT(*) AS total_count
    FROM schedule_executions se
    JOIN schedules s ON se.schedule_id = s.id
    WHERE se.planned_date = CURRENT_DATE
        AND s.status = 'active'
),
upcoming_week AS (
    SELECT
        COUNT(DISTINCT s.id) AS upcoming_schedules
    FROM schedules s
    WHERE s.next_due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
        AND s.status = 'active'
)
SELECT
    ts.completed_count,
    ts.planned_count,
    ts.overdue_count,
    ts.total_count,
    uw.upcoming_schedules,
    ROUND(
        CASE 
            WHEN ts.total_count > 0 
            THEN (ts.completed_count::numeric / ts.total_count * 100)
            ELSE 0
        END, 2
    ) AS completion_rate
FROM today_stats ts, upcoming_week uw;

-- ============================================================================
-- 8. INDEXES
-- ============================================================================

-- 환자 테이블 인덱스
CREATE INDEX idx_patients_active ON patients(is_active) WHERE is_active = true;
CREATE INDEX idx_patients_department ON patients(department);
CREATE INDEX idx_patients_search ON patients USING gin(name_search);
CREATE INDEX idx_patients_created_by ON patients(created_by);

-- 항목 테이블 인덱스
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_sort ON items(sort_order);
CREATE INDEX idx_items_code ON items(code);

-- 일정 테이블 인덱스
CREATE INDEX idx_schedules_patient ON schedules(patient_id);
CREATE INDEX idx_schedules_item ON schedules(item_id);
CREATE INDEX idx_schedules_next_due ON schedules(next_due_date) WHERE status = 'active';
CREATE INDEX idx_schedules_nurse ON schedules(assigned_nurse_id) WHERE status = 'active';
CREATE INDEX idx_schedules_composite ON schedules(patient_id, next_due_date, status);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_created_by ON schedules(created_by);

-- 부분 유니크 인덱스: 환자-항목별 활성 일정은 하나만 허용
CREATE UNIQUE INDEX idx_schedules_unique_active 
    ON schedules(patient_id, item_id) 
    WHERE status = 'active';

-- 실행 테이블 인덱스
CREATE INDEX idx_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX idx_executions_planned ON schedule_executions(planned_date, status);
-- Fixed: Removed CURRENT_DATE (STABLE function) from partial index predicate
-- CURRENT_DATE is not IMMUTABLE and cannot be used in index predicates
CREATE INDEX idx_executions_active_status ON schedule_executions(planned_date, status) 
    WHERE status IN ('planned', 'overdue');
CREATE INDEX idx_executions_executed_by ON schedule_executions(executed_by);
CREATE INDEX idx_executions_status ON schedule_executions(status);

-- 알림 테이블 인덱스
CREATE INDEX idx_notifications_ready ON notifications(notify_date, state) 
    WHERE state IN ('pending', 'ready');
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, state);
CREATE INDEX idx_notifications_schedule ON notifications(schedule_id);

-- 로그 테이블 인덱스
CREATE INDEX idx_schedule_logs_schedule ON schedule_logs(schedule_id);
CREATE INDEX idx_schedule_logs_changed_at ON schedule_logs(changed_at);
CREATE INDEX idx_schedule_logs_changed_by ON schedule_logs(changed_by);

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

-- 환자 테이블 RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurses_view_patients" ON patients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('nurse', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "admins_manage_patients" ON patients
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_active = true
        )
    );

-- 일정 테이블 RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurses_manage_schedules" ON schedules
    FOR ALL
    USING (
        assigned_nurse_id = auth.uid()
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_active = true
        )
    );

-- 실행 테이블 RLS
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurses_manage_executions" ON schedule_executions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM schedules
            WHERE id = schedule_executions.schedule_id
            AND (
                assigned_nurse_id = auth.uid()
                OR created_by = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_active = true
        )
    );

-- 알림 테이블 RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_notifications" ON notifications
    FOR SELECT
    USING (recipient_id = auth.uid());

CREATE POLICY "system_manage_notifications" ON notifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_active = true
        )
    );

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- CSV 임포트 함수 (스켈레톤)
CREATE OR REPLACE FUNCTION import_patients_csv(
    p_csv_data text,
    p_hospital_id uuid DEFAULT NULL
)
RETURNS TABLE(
    imported_count integer,
    error_count integer,
    errors jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_imported integer := 0;
    v_errors integer := 0;
    v_error_details jsonb := '[]'::jsonb;
BEGIN
    -- TODO: CSV 파싱 및 임포트 로직 구현
    -- 1. CSV 데이터 파싱
    -- 2. 각 행 검증
    -- 3. 환자 정보 암호화
    -- 4. 데이터 삽입
    -- 5. 오류 처리 및 로깅
    
    RETURN QUERY
    SELECT v_imported, v_errors, v_error_details;
END;
$$;

-- 일정 일괄 생성 함수
CREATE OR REPLACE FUNCTION create_bulk_schedules(
    p_patient_ids uuid[],
    p_item_id uuid,
    p_interval_days integer,
    p_start_date date,
    p_assigned_nurse_id uuid DEFAULT NULL,
    p_requires_notification boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer := 0;
    v_patient_id uuid;
BEGIN
    -- Set notification requirement based on interval
    IF p_interval_days >= 28 THEN
        p_requires_notification := true;
    END IF;
    
    FOREACH v_patient_id IN ARRAY p_patient_ids
    LOOP
        INSERT INTO schedules (
            patient_id,
            item_id,
            interval_days,
            start_date,
            next_due_date,
            assigned_nurse_id,
            requires_notification,
            created_by
        )
        VALUES (
            v_patient_id,
            p_item_id,
            p_interval_days,
            p_start_date,
            p_start_date,
            p_assigned_nurse_id,
            p_requires_notification,
            auth.uid()
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 11. INITIAL DATA (Optional)
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

-- ============================================================================
-- 12. GRANTS (Adjust based on your Supabase setup)
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================