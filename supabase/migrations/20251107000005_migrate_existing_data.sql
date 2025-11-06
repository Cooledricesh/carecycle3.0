-- Migration: Migrate existing data to '대동병원' organization
-- Created: 2025-11-07
-- Purpose: Assign all existing users and data to default organization
-- IMPORTANT: This migration must be run BEFORE setting organization_id to NOT NULL

BEGIN;

DO $$
DECLARE
    daedong_org_id UUID;
    affected_profiles INTEGER;
    affected_patients INTEGER;
    affected_items INTEGER;
    affected_schedules INTEGER;
    affected_executions INTEGER;
    affected_notifications INTEGER;
    affected_audit_logs INTEGER;
BEGIN
    -- 1. '대동병원' organization 생성 (이미 존재하면 ID만 가져옴)
    INSERT INTO public.organizations (name)
    VALUES ('대동병원')
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO daedong_org_id;

    -- 이미 존재하는 경우 ID 가져오기
    IF daedong_org_id IS NULL THEN
        SELECT id INTO daedong_org_id FROM public.organizations WHERE name = '대동병원';
    END IF;

    RAISE NOTICE '대동병원 organization ID: %', daedong_org_id;

    -- 2. 모든 기존 사용자를 '대동병원'에 소속
    UPDATE public.profiles
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_profiles = ROW_COUNT;
    RAISE NOTICE '% profiles updated with organization_id', affected_profiles;

    -- 3. 모든 기존 환자 데이터를 '대동병원'에 귀속
    UPDATE public.patients
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_patients = ROW_COUNT;
    RAISE NOTICE '% patients updated with organization_id', affected_patients;

    -- 4. 모든 기존 항목 데이터를 '대동병원'에 귀속
    UPDATE public.items
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_items = ROW_COUNT;
    RAISE NOTICE '% items updated with organization_id', affected_items;

    -- 5. 모든 기존 일정 데이터를 '대동병원'에 귀속
    UPDATE public.schedules
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_schedules = ROW_COUNT;
    RAISE NOTICE '% schedules updated with organization_id', affected_schedules;

    -- 6. 모든 기존 시행 기록을 '대동병원'에 귀속
    UPDATE public.schedule_executions
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_executions = ROW_COUNT;
    RAISE NOTICE '% schedule_executions updated with organization_id', affected_executions;

    -- 7. 모든 기존 알림을 '대동병원'에 귀속
    UPDATE public.notifications
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_notifications = ROW_COUNT;
    RAISE NOTICE '% notifications updated with organization_id', affected_notifications;

    -- 8. 모든 기존 감사 로그를 '대동병원'에 귀속
    UPDATE public.audit_logs
    SET organization_id = daedong_org_id
    WHERE organization_id IS NULL;

    GET DIAGNOSTICS affected_audit_logs = ROW_COUNT;
    RAISE NOTICE '% audit_logs updated with organization_id', affected_audit_logs;

    RAISE NOTICE '=== Migration Summary ===';
    RAISE NOTICE 'Organization: 대동병원 (ID: %)', daedong_org_id;
    RAISE NOTICE 'Profiles: %', affected_profiles;
    RAISE NOTICE 'Patients: %', affected_patients;
    RAISE NOTICE 'Items: %', affected_items;
    RAISE NOTICE 'Schedules: %', affected_schedules;
    RAISE NOTICE 'Executions: %', affected_executions;
    RAISE NOTICE 'Notifications: %', affected_notifications;
    RAISE NOTICE 'Audit Logs: %', affected_audit_logs;
    RAISE NOTICE '모든 기존 데이터가 대동병원에 귀속되었습니다.';
END $$;

COMMIT;
