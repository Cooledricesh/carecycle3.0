import { describe, it, expect, vi, beforeEach } from 'vitest'
import { activityService } from '../activityService'
import type { AuditLog } from '@/types/activity'
import { MOCK_TEST_DATA } from '@/lib/test-helpers/mock-data'

describe('ActivityService - BUG-2025-11-12-ACTIVITY-LOG-UNKNOWN-USER', () => {
  describe('generateDescription - Unknown User Bug', () => {
    // RED Phase: 현재 문제 재현 테스트
    it('should NOT display "알 수 없음" when userName is null but userEmail is available', () => {
      const log: AuditLog = {
        id: 'test-id',
        tableName: 'schedules',
        operation: 'UPDATE',
        recordId: 'record-123',
        oldValues: { status: 'active' },
        newValues: { status: 'paused' },
        userId: 'user-123',
        userEmail: 'mock-testuser@example.test',
        userName: null, // 문제 상황: name이 NULL
        userRole: 'nurse',
        timestamp: new Date().toISOString(),
        ipAddress: null,
        userAgent: null,
      }

      const description = activityService.generateDescription(log)

      // 현재 실패: "알 수 없음님이..."로 표시됨
      // 기대: "mock-testuser님이..." 또는 email 앞부분 표시
      expect(description).not.toContain('알 수 없음')
      expect(description).toContain('mock-testuser')
    })

    it('should fallback to email username when both userName and userEmail are available', () => {
      const log: AuditLog = {
        id: 'test-id',
        tableName: 'patients',
        operation: 'INSERT',
        recordId: 'patient-123',
        oldValues: null,
        newValues: { patient_name: '홍길동' },
        userId: 'user-123',
        userEmail: 'mock-doctor.kim@hospital.test',
        userName: null,
        userRole: 'doctor',
        timestamp: new Date().toISOString(),
        ipAddress: null,
        userAgent: null,
      }

      const description = activityService.generateDescription(log)

      expect(description).toContain('mock-doctor.kim')
      expect(description).not.toContain('알 수 없음')
    })

    it('should display "알 수 없음" ONLY when both userName and userEmail are null', () => {
      const log: AuditLog = {
        id: 'test-id',
        tableName: 'schedules',
        operation: 'DELETE',
        recordId: 'schedule-123',
        oldValues: { patient_name: '테스트' },
        newValues: null,
        userId: null,
        userEmail: null,
        userName: null,
        userRole: null,
        timestamp: new Date().toISOString(),
        ipAddress: null,
        userAgent: null,
      }

      const description = activityService.generateDescription(log)

      // 이 경우에만 "알 수 없음" 허용
      expect(description).toContain('알 수 없음')
    })

    it('should prioritize userName over userEmail when both are available', () => {
      const log: AuditLog = {
        id: 'test-id',
        tableName: 'schedules',
        operation: 'UPDATE',
        recordId: 'record-123',
        oldValues: {},
        newValues: {},
        userId: 'user-123',
        userEmail: MOCK_TEST_DATA.email,
        userName: '김철수', // name이 있으면 우선 사용
        userRole: 'admin',
        timestamp: new Date().toISOString(),
        ipAddress: null,
        userAgent: null,
      }

      const description = activityService.generateDescription(log)

      expect(description).toContain('김철수')
      expect(description).not.toContain('mock-test')
    })
  })
})
