/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Legacy service with complex type issues, needs refactoring
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@/lib/supabase/database'
import type {
  ActivityStats,
  ActivityFilters,
  PaginatedAuditLogs,
  AuditLog,
} from '@/types/activity'

export const activityService = {
  async getStats(supabase?: SupabaseClient): Promise<ActivityStats> {
    const client = supabase || createClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [usersResult, activeUsersResult, todayLogsResult] = await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }),
      client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('approval_status', 'approved'),
      client
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('timestamp', todayISO),
    ])

    const totalUsers = usersResult.count || 0
    const activeUsers = activeUsersResult.count || 0
    const todayActivities = todayLogsResult.count || 0

    const { data: connectionCheck } = await client
      .from('profiles')
      .select('id')
      .limit(1)
      .single()

    const systemStatus = connectionCheck ? 'healthy' : 'error'

    const { count: criticalAlerts } = await client
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('operation', 'DELETE')
      .gte('timestamp', todayISO)

    return {
      totalUsers,
      activeUsers,
      todayActivities,
      systemStatus,
      criticalAlerts: criticalAlerts || 0,
    }
  },

  async getAuditLogs(
    filters: ActivityFilters = {},
    supabase?: SupabaseClient
  ): Promise<PaginatedAuditLogs> {
    const client = supabase || createClient()

    const {
      startDate,
      endDate,
      userId,
      tableName,
      operation,
      page = 1,
      limit = 20,
    } = filters

    // Simple select without JOIN since there's no foreign key relationship
    let query = client
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })

    if (startDate) {
      query = query.gte('timestamp', startDate)
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      query = query.lte('timestamp', endDateTime.toISOString())
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (tableName) {
      query = query.eq('table_name', tableName)
    }

    if (operation) {
      query = query.eq('operation', operation)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[activityService.getAuditLogs] Error:', error)
      throw new Error(`활동 로그 조회 실패: ${error.message}`)
    }

    const logs: AuditLog[] =
      data?.map((row) => ({
        id: row.id,
        tableName: row.table_name,
        operation: row.operation,
        recordId: row.record_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        userId: row.user_id,
        userEmail: row.user_email,
        // Use the user_name field from audit_logs (populated by our migration)
        userName: row.user_name || null,
        userRole: row.user_role,
        timestamp: row.timestamp,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      })) || []

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    }
  },

  generateDescription(log: AuditLog): string {
    const table = log.tableName || 'unknown'
    const operation = log.operation || 'UNKNOWN'
    const userName = log.userName || log.userEmail?.split('@')[0] || '알 수 없음'

    switch (operation) {
      case 'INSERT':
        return this.generateInsertDescription(table, userName, log.newValues)

      case 'UPDATE':
        return this.generateUpdateDescription(table, userName, log.oldValues, log.newValues)

      case 'DELETE':
        return this.generateDeleteDescription(table, userName, log.oldValues)

      default:
        return `${userName}님이 ${table}에서 ${operation} 작업을 수행했습니다`
    }
  },

  generateInsertDescription(
    table: string,
    userName: string,
    newValues: Record<string, any> | null
  ): string {
    if (table === 'patients' && newValues) {
      const patientName = newValues.name || '이름 없음'
      const patientNumber = newValues.patient_number || ''
      const careType = newValues.care_type || ''
      return `${userName}님이 새로운 환자를 등록했습니다. (${patientName} ${patientNumber}${careType ? ` - ${careType}` : ''})`
    }

    if (table === 'schedules' && newValues) {
      const patientName = newValues._patient_name || '환자'
      const itemName = newValues._item_name || '항목'
      const startDate = newValues.start_date || newValues.next_due_date || ''
      return `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 생성했습니다.${startDate ? ` (시작일: ${startDate})` : ''}`
    }

    if (table === 'profiles' && newValues) {
      const email = newValues.email || ''
      const role = newValues.role || ''
      return `${userName}님이 가입했습니다. (${email}${role ? ` - ${role}` : ''})`
    }

    return `${userName}님이 ${table}에 새로운 데이터를 추가했습니다.`
  },

  generateUpdateDescription(
    table: string,
    userName: string,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null
  ): string {
    if (!oldValues || !newValues) {
      return `${userName}님이 ${table} 데이터를 수정했습니다.`
    }

    const changes: string[] = []

    if (table === 'patients') {
      if (oldValues.name !== newValues.name) {
        changes.push(`이름: ${oldValues.name} → ${newValues.name}`)
      }
      if (oldValues.care_type !== newValues.care_type) {
        changes.push(`진료구분: ${oldValues.care_type || '없음'} → ${newValues.care_type || '없음'}`)
      }
      if (oldValues.doctor_id !== newValues.doctor_id) {
        changes.push(`담당의 변경`)
      }
      if (oldValues.is_active !== newValues.is_active) {
        changes.push(`활성상태: ${oldValues.is_active ? '활성' : '비활성'} → ${newValues.is_active ? '활성' : '비활성'}`)
      }

      const patientName = newValues.name || oldValues.name || '환자'
      return changes.length > 0
        ? `${userName}님이 ${patientName} 환자 정보를 수정했습니다: ${changes.join(', ')}.`
        : `${userName}님이 ${patientName} 환자 정보를 수정했습니다.`
    }

    if (table === 'schedules') {
      const patientName = newValues._patient_name || oldValues._patient_name || '환자'
      const itemName = newValues._item_name || oldValues._item_name || '항목'

      const statusChanged = oldValues.status !== newValues.status

      // 완료처리 감지: last_executed_date 필드가 변경됨 (Phase 1 분석 결과 기반)
      const isCompletion =
        oldValues.last_executed_date !== newValues.last_executed_date &&
        newValues.last_executed_date !== null &&
        oldValues.status === 'active' &&
        newValues.status === 'active'

      // 삭제 처리 감지: active → cancelled
      const isDeletion = statusChanged && oldValues.status === 'active' && newValues.status === 'cancelled'

      // 삭제 처리인 경우
      if (isDeletion) {
        return `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 삭제했습니다.`
      }

      // 완료처리가 아닌 상태 변경
      if (statusChanged && !isCompletion) {
        changes.push(`상태: ${oldValues.status} → ${newValues.status}`)
      }

      // 완료처리가 아닌 날짜 변경만 기록
      if (!isCompletion && oldValues.next_due_date !== newValues.next_due_date) {
        changes.push(`다음 예정일: ${oldValues.next_due_date} → ${newValues.next_due_date}`)
      }

      if (oldValues.assigned_nurse_id !== newValues.assigned_nurse_id) {
        changes.push(`담당 간호사 변경`)
      }
      const oldNotes = oldValues.notes || ''
      const newNotes = newValues.notes || ''
      if (oldNotes !== newNotes) {
        changes.push(`메모 수정`)
      }

      // 완료처리인 경우
      if (isCompletion) {
        return `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 완료처리 했습니다.`
      }

      return changes.length > 0
        ? `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 수정했습니다: ${changes.join(', ')}.`
        : `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 수정했습니다.`
    }

    if (table === 'profiles') {
      if (oldValues.name !== newValues.name) {
        changes.push(`이름: ${oldValues.name} → ${newValues.name}`)
      }
      if (oldValues.role !== newValues.role) {
        changes.push(`역할: ${oldValues.role} → ${newValues.role}`)
      }
      if (oldValues.care_type !== newValues.care_type) {
        changes.push(`진료구분: ${oldValues.care_type || '없음'} → ${newValues.care_type || '없음'}`)
      }
      if (oldValues.approval_status !== newValues.approval_status) {
        changes.push(`승인상태: ${oldValues.approval_status} → ${newValues.approval_status}`)
      }

      return changes.length > 0
        ? `${userName}님이 프로필을 수정했습니다: ${changes.join(', ')}.`
        : `${userName}님이 프로필을 수정했습니다.`
    }

    return `${userName}님이 ${table} 데이터를 수정했습니다.`
  },

  generateDeleteDescription(
    table: string,
    userName: string,
    oldValues: Record<string, any> | null
  ): string {
    if (table === 'patients' && oldValues) {
      const patientName = oldValues.name || '이름 없음'
      const patientNumber = oldValues.patient_number || ''
      return `${userName}님이 ${patientName} 환자를 삭제했습니다. (${patientNumber})`
    }

    if (table === 'schedules' && oldValues) {
      const patientName = oldValues._patient_name || '환자'
      const itemName = oldValues._item_name || '항목'
      return `${userName}님이 ${patientName} 환자의 ${itemName} 스케줄을 삭제했습니다.`
    }

    if (table === 'profiles' && oldValues) {
      const email = oldValues.email || ''
      return `${userName}님이 사용자를 삭제했습니다. (${email})`
    }

    return `${userName}님이 ${table} 데이터를 삭제했습니다.`
  },
}