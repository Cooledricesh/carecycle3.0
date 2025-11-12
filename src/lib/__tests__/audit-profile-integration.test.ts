/**
 * Integration Test for BUG-2025-11-12-ACTIVITY-LOG-UNKNOWN-USER
 *
 * 이 테스트는 데이터베이스 레벨에서 audit_logs.user_name이 NULL로 저장되는 문제를 검증합니다.
 *
 * 테스트 시나리오:
 * 1. profiles.name이 NULL인 사용자가 데이터를 수정할 때
 * 2. audit_table_changes() 트리거가 발동되어 audit_logs 생성
 * 3. get_user_profile_for_audit() 함수가 profiles에서 name을 가져옴
 * 4. profiles.name이 NULL이면 audit_logs.user_name도 NULL로 저장됨
 *
 * 기대 동작:
 * - profiles.name이 NULL이어도 email 기반 fallback으로 user_name 설정
 * - audit_logs.user_name이 NULL이 아닌 유효한 값으로 저장
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServiceClient } from '@/lib/supabase/server'

describe('Audit Profile Integration - BUG-2025-11-12', () => {
  let supabase: Awaited<ReturnType<typeof createServiceClient>>
  let testUserId: string
  let testPatientId: string

  beforeAll(async () => {
    supabase = await createServiceClient()

    // 1. 테스트 사용자 생성 (profiles.name = NULL 상태로)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test-null-name@example.com',
      password: 'Test123!@#',
      email_confirm: true,
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`)
    }

    testUserId = authData.user.id

    // 2. profiles에서 name을 NULL로 강제 설정
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ name: null })
      .eq('id', testUserId)

    if (updateError) {
      throw new Error(`Failed to set name to NULL: ${updateError.message}`)
    }

    // 3. 테스트 환자 생성
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert({
        patient_name: '테스트-audit-integration',
        birth_date: '1990-01-01',
        medical_record_number: `TEST-AUDIT-${Date.now()}`,
        organization_id: null, // 테스트 환경에서 NULL 허용
      })
      .select('id')
      .single()

    if (patientError || !patientData) {
      throw new Error(`Failed to create test patient: ${patientError?.message}`)
    }

    testPatientId = patientData.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    if (testPatientId) {
      await supabase.from('patients').delete().eq('id', testPatientId)
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })

  it('should NOT store NULL in audit_logs.user_name when profiles.name is NULL', async () => {
    // RED Phase: 현재는 실패할 것으로 예상

    // 1. profiles.name이 NULL인지 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', testUserId)
      .single()

    expect(profile).toBeDefined()
    expect(profile!.name).toBeNull() // name이 NULL이어야 함
    expect(profile!.email).toBe('test-null-name@example.com')

    // 2. 해당 사용자로 환자 데이터 수정 (audit trigger 발동)
    const { error: updateError } = await supabase
      .from('patients')
      .update({ patient_name: '테스트-audit-updated' })
      .eq('id', testPatientId)

    expect(updateError).toBeNull()

    // 3. audit_logs에 기록된 user_name 확인
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('user_name, user_email, user_id')
      .eq('table_name', 'patients')
      .eq('record_id', testPatientId)
      .order('timestamp', { ascending: false })
      .limit(1)

    expect(auditError).toBeNull()
    expect(auditLogs).toBeDefined()
    expect(auditLogs!.length).toBeGreaterThan(0)

    const latestLog = auditLogs![0]

    // 4. 검증: user_name이 NULL이면 안됨
    // 현재 실패 예상: user_name이 NULL로 저장됨
    // 수정 후 기대: email 앞부분이 user_name으로 저장됨
    expect(latestLog.user_name).not.toBeNull()
    expect(latestLog.user_name).toBe('test-null-name') // email 앞부분
    expect(latestLog.user_email).toBe('test-null-name@example.com')
  })

  it('should use email-based fallback in get_user_profile_for_audit()', async () => {
    // get_user_profile_for_audit() 함수 직접 호출 테스트

    const { data, error } = await supabase.rpc('get_user_profile_for_audit', {
      target_user_id: testUserId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()

    if (Array.isArray(data) && data.length > 0) {
      const profile = data[0]

      // 현재 실패 예상: name이 NULL
      // 수정 후 기대: email 앞부분이 name으로 반환
      expect(profile.name).not.toBeNull()
      expect(profile.name).toBe('test-null-name')
      expect(profile.email).toBe('test-null-name@example.com')
    } else {
      throw new Error('RPC returned unexpected data format')
    }
  })
})
