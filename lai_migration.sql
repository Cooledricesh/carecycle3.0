-- LAI 환자 데이터 마이그레이션 SQL 스크립트
-- 생성일: 2025-09-02
-- 대상: 57명 LAI 환자 (최수현 제외 - 이미 존재)
-- 
-- 주의사항:
-- 1. 환자번호(patient_number)를 기준으로 매칭
-- 2. items.default_interval_weeks를 schedules.interval_weeks에 매핑
-- 3. LAI 용량을 schedules.notes에 저장
-- 4. 트랜잭션으로 원자성 보장

BEGIN;

-- ==========================================
-- STEP 1: 임시 테이블 생성 및 데이터 준비
-- ==========================================

CREATE TEMP TABLE temp_lai_migration (
    patient_number TEXT,
    patient_name TEXT,
    lai_drug TEXT,
    lai_dose TEXT,
    next_date TEXT
);

-- CSV 데이터 삽입 (57명)
INSERT INTO temp_lai_migration (patient_number, patient_name, lai_drug, lai_dose, next_date) VALUES
('2101780', '김태희', '인베가 하피에라', '700', '2025. 12. 9'),
('2129822', '남대식', '인베가 하피에라', '1000', '2025. 11. 19'),
('2061138', '시지안', '아빌리파이 메인테나', '400', '2025. 8. 11'),
('2137404', '전은혜', '인베가 하피에라', '1000', '2025. 9. 17'),
('2124334', '전혜심', '인베가 하피에라', '1000', '2025. 9. 11'),
('105561', '정하영', '인베가 트린자', '525', '2025. 10. 29'),
('102706', '최용석', '인베가 하피에라', '1000', '2025. 11. 17'),
('2071360', '김동현', '인베가 트린자', '525', '2025. 10. 22'),
('2118539', '김태우', '인베가 하피에라', '1000', '2026. 1. 7'),
('2135331', '배석준', '아빌리파이 아심투파이', '960', '2025. 9. 2'),
('101338', '이동구', '아빌리파이 메인테나', '400', '2025. 9. 4'),
('2030954', '이상재', '인베가 하피에라', '1000', '2025. 9. 2'),
('2013223', '임명숙', '인베가 하피에라', '1000', '2025. 11. 25'),
('2003170', '최은지', '인베가 하피에라', '1000', '2025. 12. 22'),
('974373', '이동희', '아빌리파이 아심투파이', '960', '2025. 10. 22'),
('2022320', '이승희', '인베가 하피에라', '1000', '2025. 9. 5'),
('2210311', '정준혁', '아빌리파이 메인테나', '400', '2025. 9. 11'),
('2051121', '제종규', '아빌리파이 아심투파이', '960', '2025. 9. 9'),
('995326', '김무애', '아빌리파이 아심투파이', '960', '2025. 9. 4'),
('2006350', '백진주', '인베가 서스티나', '150', '2025. 9. 22'),
('2233167', '이상윤', '인베가 하피에라', '1000', '2025. 12. 29'),
('2200901', '이연옥', '인베가 하피에라', '1000', '2025. 12. 11'),
('2127540', '이인숙', '인베가 트린자', '525', '2025. 10. 28'),
('2118912', '최영일', '인베가 하피에라', '1000', '2025. 11. 14'),
('2032607', '김정희', '인베가 하피에라', '1000', '2025. 12. 25'),
('2221205', '박구훈', '인베가 하피에라', '700', '2025. 9. 9'),
('2101913', '이정원', '인베가 하피에라', '1000', '2026. 2. 5'),
('2060314', '최덕림', '인베가 서스티나', '100', '2025. 9. 18'),
('103524', '구영숙', '인베가 하피에라', '1000', '2025. 9. 30'),
('2127434', '남종우', '인베가 하피에라', '1000', '2025. 9. 22'),
('2120494', '서정인', '인베가 트린자', '525', '2025. 11. 12'),
('2051050', '손홍관', '인베가 서스티나', '100', '2025. 9. 24'),
('2030963', '신주영', '인베가 하피에라', '1000', '2025. 9. 17'),
('2114545', '임현정', '인베가 하피에라', '700', '2025. 11. 19'),
('2082554', '최지훈', '인베가 하피에라', '1000', '2025. 10. 7'),
('102470', '석미순', '인베가 트린자', '525', '2025. 9. 16'),
('102226', '우창형', '인베가 하피에라', '1000', '2025. 9. 5'),
('101634', '위선희', '인베가 하피에라', '1000', '2026. 1. 21'),
('2005716', '전희진', '아빌리파이 아심투파이', '960', '2025. 10. 16'),
('102496', '최의환', '인베가 하피에라', '1000', '2025. 10. 14'),
-- 최수현 제외 (이미 존재: 2117226)
('105174', '이선호', '인베가 하피에라', '1000', '2025. 10. 17'),
('2136863', '이정철', '인베가 트린자', '263', '2025. 11. 11'),
('105165', '최정애', '아빌리파이 아심투파이', '960', '2025. 10. 23'),
('101273', '최태순', '아빌리파이 메인테나', '300', '2025. 9. 4'),
('2121156', '한명수', '인베가 트린자', '525', '2025. 9. 22'),
('2212693', '한수자', '인베가 트린자', '263', '2025. 9. 24'),
('2051152', '김광분', '인베가 하피에라', '1000', '2025. 10. 2'),
('104663', '박찬동', '인베가 하피에라', '1000', '2026. 1. 1'),
('2246150', '박성준', '인베가 하피에라', '1000', '2026. 1. 6'),
('2020719', '신은경', '인베가 하피에라', '1000', '2026. 1. 6'),
('2247000', '김영욱', '인베가 하피에라', '1000', '2025. 11. 17'),
('2061794', '최은규', '인베가 서스티나', '150', '2025. 9. 17'),
('102694', '김무숙', '인베가 하피에라', '1000', '2025. 11. 7'),
('2247959', '장언수', '인베가 하피에라', '1000', '2026. 2. 5'),
('2005372', '정춘희', '인베가 하피에라', '1000', '2025. 10. 27'),
('102998', '류선자', '인베가 트린자', '525', '2025. 10. 29');

-- ==========================================
-- STEP 2: 환자 데이터 UPSERT
-- ==========================================

-- 기존 환자 확인 및 업데이트, 신규 환자 추가
WITH migration_patients AS (
    SELECT DISTINCT 
        patient_number,
        patient_name
    FROM temp_lai_migration
)
INSERT INTO patients (
    patient_number,
    name,
    is_active,
    care_type,
    created_by,
    created_at
)
SELECT 
    mp.patient_number,
    mp.patient_name,
    true,
    '외래',
    '61a97bc8-2662-48fa-8166-1f526e591a35'::uuid, -- 샘플과 동일한 user_id
    NOW()
FROM migration_patients mp
ON CONFLICT (patient_number) 
DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- ==========================================
-- STEP 3: 스케줄 데이터 생성
-- ==========================================

-- 기존 스케줄 확인 (중복 방지)
WITH existing_schedules AS (
    SELECT 
        p.patient_number,
        i.name as item_name
    FROM schedules s
    JOIN patients p ON s.patient_id = p.id
    JOIN items i ON s.item_id = i.id
    WHERE s.status = 'active'
)
-- 신규 스케줄 생성
INSERT INTO schedules (
    patient_id,
    item_id,
    start_date,
    next_due_date,
    status,
    interval_weeks,
    notes,
    requires_notification,
    notification_days_before,
    priority,
    created_by,
    assigned_nurse_id
)
SELECT 
    p.id as patient_id,
    i.id as item_id,
    TO_DATE(REPLACE(t.next_date, '. ', '-'), 'YYYY-MM-DD') as start_date,
    TO_DATE(REPLACE(t.next_date, '. ', '-'), 'YYYY-MM-DD') as next_due_date,
    'active' as status,
    i.default_interval_weeks as interval_weeks,
    t.lai_dose as notes,  -- 용량 정보를 notes에 저장
    true as requires_notification,
    7 as notification_days_before,
    0 as priority,
    '61a97bc8-2662-48fa-8166-1f526e591a35'::uuid as created_by,
    '61a97bc8-2662-48fa-8166-1f526e591a35'::uuid as assigned_nurse_id
FROM temp_lai_migration t
JOIN patients p ON p.patient_number = t.patient_number
JOIN items i ON i.name = t.lai_drug AND i.category = 'injection'
LEFT JOIN existing_schedules es ON es.patient_number = t.patient_number AND es.item_name = t.lai_drug
WHERE es.patient_number IS NULL;  -- 중복 제외

-- ==========================================
-- STEP 4: 결과 검증
-- ==========================================

-- 마이그레이션 결과 통계
DO $$
DECLARE
    v_total_patients INTEGER;
    v_new_schedules INTEGER;
    v_skipped_schedules INTEGER;
BEGIN
    -- 처리된 환자 수
    SELECT COUNT(DISTINCT patient_number) INTO v_total_patients
    FROM temp_lai_migration;
    
    -- 생성된 스케줄 수
    SELECT COUNT(*) INTO v_new_schedules
    FROM schedules
    WHERE created_at >= NOW() - INTERVAL '1 minute';
    
    -- 중복으로 스킵된 스케줄 수
    v_skipped_schedules := v_total_patients - v_new_schedules;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE '마이그레이션 완료 통계';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '총 처리 환자 수: %', v_total_patients;
    RAISE NOTICE '신규 생성 스케줄: %', v_new_schedules;
    RAISE NOTICE '중복 스킵 스케줄: %', v_skipped_schedules;
    RAISE NOTICE '==========================================';
END $$;

-- 약물별 스케줄 분포 확인
SELECT 
    i.name as "LAI 약물",
    COUNT(*) as "스케줄 수",
    STRING_AGG(DISTINCT s.notes, ', ') as "용량 종류"
FROM schedules s
JOIN items i ON s.item_id = i.id
WHERE s.status = 'active'
  AND i.category = 'injection'
GROUP BY i.name
ORDER BY COUNT(*) DESC;

-- 긴급도별 스케줄 확인 (9월 투여 예정)
SELECT 
    p.patient_number as "환자번호",
    p.name as "환자명",
    i.name as "LAI 약물",
    s.notes as "용량",
    s.next_due_date as "다음 투여일",
    CASE 
        WHEN s.next_due_date <= '2025-09-30' THEN '🔴 긴급'
        WHEN s.next_due_date <= '2025-10-31' THEN '🟡 주의'
        ELSE '🟢 여유'
    END as "우선순위"
FROM schedules s
JOIN patients p ON s.patient_id = p.id
JOIN items i ON s.item_id = i.id
WHERE s.status = 'active'
  AND i.category = 'injection'
  AND s.next_due_date >= CURRENT_DATE
ORDER BY s.next_due_date
LIMIT 20;

-- 트랜잭션 커밋
COMMIT;

-- ==========================================
-- 롤백이 필요한 경우 아래 명령 실행
-- ROLLBACK;
-- ==========================================