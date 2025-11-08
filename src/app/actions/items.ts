'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteItemAction(id: string) {
  try {
    // 사용자 인증 확인
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()

    if (!user) {
      throw new Error('인증되지 않은 사용자입니다.')
    }

    // 관리자 권한 및 organization_id 확인
    const { data: profile } = await userClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.')
    }

    if (!profile?.organization_id) {
      throw new Error('조직 정보가 없습니다.')
    }

    const organizationId = profile.organization_id

    // Service Client로 작업 (RLS 우회)
    const serviceClient = await createServiceClient()

    // 0. item이 해당 조직에 속하는지 확인
    const { data: item, error: itemError } = await serviceClient
      .from('items')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (itemError || !item) {
      throw new Error('항목을 찾을 수 없거나 접근 권한이 없습니다.')
    }

    // 1. 관련 스케줄 찾기
    const { data: schedules, error: schedulesError } = await serviceClient
      .from('schedules')
      .select('id')
      .eq('item_id', id)
      .eq('organization_id', organizationId)

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError)
      throw new Error(`스케줄 조회 실패: ${schedulesError.message}`)
    }

    // 2. 실행 기록 확인 (의료 기록 보호)
    if (schedules && schedules.length > 0) {
      const scheduleIds = schedules.map(s => s.id)

      const { data: executions, error: executionsError } = await serviceClient
        .from('schedule_executions')
        .select('id')
        .eq('status', 'completed')
        .in('schedule_id', scheduleIds)
        .limit(1)

      if (executionsError) {
        console.error('Error fetching executions:', executionsError)
        throw new Error(`실행 기록 조회 실패: ${executionsError.message}`)
      }

      if (executions && executions.length > 0) {
        throw new Error('이 항목은 실행 기록이 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.')
      }

      // 3. 관련 데이터 삭제 (트리거 수정으로 단순화)
      // notifications 먼저 삭제 (schedule 참조)
      const { error: notificationsError } = await serviceClient
        .from('notifications')
        .delete()
        .in('schedule_id', scheduleIds)

      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError)
        throw new Error(`알림 삭제 실패: ${notificationsError.message}`)
      }
    }

    // schedules 삭제 (트리거가 DELETE를 로깅하지 않음)
    const { error: schedulesDeleteError } = await serviceClient
      .from('schedules')
      .delete()
      .eq('item_id', id)

    if (schedulesDeleteError) {
      console.error('Error deleting schedules:', schedulesDeleteError)
      throw new Error(`스케줄 삭제 실패: ${schedulesDeleteError.message}`)
    }

    // 3. item 삭제 (organization_id 필터링 추가)
    const { error: deleteError } = await serviceClient
      .from('items')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error deleting item:', deleteError)
      throw deleteError
    }

    revalidatePath('/dashboard/items')
    return { success: true }
  } catch (error) {
    console.error('Delete item action error:', error)
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    throw error
  }
}