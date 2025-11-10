import { describe, it, expect } from 'vitest'
import { sortSchedulesByPriority } from '../schedule-status'
import type { ScheduleWithDetails } from '@/types/schedule'

describe('sortSchedulesByPriority', () => {
  const createMockSchedule = (overrides: Partial<ScheduleWithDetails> & { display_type?: string }): ScheduleWithDetails => ({
    schedule_id: 'test-id',
    patient_id: 'patient-1',
    patient_name: '테스트 환자',
    patient_care_type: '외래',
    patient_number: 'P001',
    doctor_id: null,
    doctor_name: '',
    item_id: 'item-1',
    item_name: '혈액검사',
    item_category: 'test',
    next_due_date: '2025-01-15',
    status: 'active',
    interval_weeks: 4,
    priority: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    notes: null,
    ...overrides,
  })

  describe('Phase 3.1: Sorting by completion status', () => {
    it('should sort incomplete schedules before completed schedules', () => {
      const schedules: (ScheduleWithDetails & { display_type?: string })[] = [
        { ...createMockSchedule({ next_due_date: '2025-01-15' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: '2025-01-16' }), display_type: 'scheduled' },
        { ...createMockSchedule({ next_due_date: '2025-01-14' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: '2025-01-17' }), display_type: 'scheduled' },
      ]

      const sorted = sortSchedulesByPriority(schedules as ScheduleWithDetails[])

      // First two should be scheduled (incomplete)
      expect((sorted[0] as any).display_type).toBe('scheduled')
      expect((sorted[1] as any).display_type).toBe('scheduled')
      // Last two should be completed
      expect((sorted[2] as any).display_type).toBe('completed')
      expect((sorted[3] as any).display_type).toBe('completed')
    })

    it('should maintain priority sorting within incomplete schedules', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const schedules: (ScheduleWithDetails & { display_type?: string })[] = [
        { ...createMockSchedule({ next_due_date: tomorrow }), display_type: 'scheduled' }, // future
        { ...createMockSchedule({ next_due_date: yesterday }), display_type: 'scheduled' }, // overdue
        { ...createMockSchedule({ next_due_date: today }), display_type: 'scheduled' }, // today
      ]

      const sorted = sortSchedulesByPriority(schedules as ScheduleWithDetails[])

      // Should be ordered: overdue > today > future
      expect(sorted[0].next_due_date).toBe(yesterday)
      expect(sorted[1].next_due_date).toBe(today)
      expect(sorted[2].next_due_date).toBe(tomorrow)
    })

    it('should sort completed schedules by date descending (most recent first)', () => {
      const schedules: (ScheduleWithDetails & { display_type?: string })[] = [
        { ...createMockSchedule({ next_due_date: '2025-01-10' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: '2025-01-15' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: '2025-01-12' }), display_type: 'completed' },
      ]

      const sorted = sortSchedulesByPriority(schedules as ScheduleWithDetails[])

      // Should be ordered by date descending (most recent first)
      expect(sorted[0].next_due_date).toBe('2025-01-15')
      expect(sorted[1].next_due_date).toBe('2025-01-12')
      expect(sorted[2].next_due_date).toBe('2025-01-10')
    })

    it('should handle mixed completed and incomplete schedules correctly', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      const schedules: (ScheduleWithDetails & { display_type?: string })[] = [
        { ...createMockSchedule({ next_due_date: '2025-01-20' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: yesterday }), display_type: 'scheduled' }, // overdue
        { ...createMockSchedule({ next_due_date: '2025-01-18' }), display_type: 'completed' },
        { ...createMockSchedule({ next_due_date: today }), display_type: 'scheduled' }, // today
      ]

      const sorted = sortSchedulesByPriority(schedules as ScheduleWithDetails[])

      // First two should be incomplete (overdue, today)
      expect((sorted[0] as any).display_type).toBe('scheduled')
      expect(sorted[0].next_due_date).toBe(yesterday)
      expect((sorted[1] as any).display_type).toBe('scheduled')
      expect(sorted[1].next_due_date).toBe(today)

      // Last two should be completed (sorted by date desc)
      expect((sorted[2] as any).display_type).toBe('completed')
      expect(sorted[2].next_due_date).toBe('2025-01-20')
      expect((sorted[3] as any).display_type).toBe('completed')
      expect(sorted[3].next_due_date).toBe('2025-01-18')
    })

    it('should handle schedules without display_type as incomplete', () => {
      const schedules: ScheduleWithDetails[] = [
        createMockSchedule({ next_due_date: '2025-01-15' }), // no display_type
        { ...createMockSchedule({ next_due_date: '2025-01-14' }), display_type: 'completed' } as ScheduleWithDetails,
      ]

      const sorted = sortSchedulesByPriority(schedules)

      // Schedule without display_type should come first (treated as incomplete)
      expect((sorted[0] as any).display_type).toBeUndefined()
      expect((sorted[1] as any).display_type).toBe('completed')
    })

    it('should handle empty array', () => {
      const sorted = sortSchedulesByPriority([])
      expect(sorted).toEqual([])
    })

    it('should handle single schedule', () => {
      const schedule = createMockSchedule({ next_due_date: '2025-01-15' })
      const sorted = sortSchedulesByPriority([schedule])
      expect(sorted).toHaveLength(1)
      expect(sorted[0]).toEqual(schedule)
    })
  })

  describe('Existing priority sorting (regression tests)', () => {
    it('should continue to sort by priority when all schedules are incomplete', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const schedules = [
        createMockSchedule({ next_due_date: tomorrow }),
        createMockSchedule({ next_due_date: yesterday }),
        createMockSchedule({ next_due_date: today }),
      ]

      const sorted = sortSchedulesByPriority(schedules)

      // Should maintain existing priority: overdue > today > future
      expect(sorted[0].next_due_date).toBe(yesterday)
      expect(sorted[1].next_due_date).toBe(today)
      expect(sorted[2].next_due_date).toBe(tomorrow)
    })
  })
})
