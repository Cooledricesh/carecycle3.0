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

    // 관리자 권한 확인
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.')
    }

    // Service Client로 작업 (RLS 우회)
    const serviceClient = await createServiceClient()

    // 1. 관련 스케줄 찾기
    const { data: schedules } = await serviceClient
      .from('schedules')
      .select('id')
      .eq('item_id', id)

    // 2. 실행 기록 확인 (의료 기록 보호)
    if (schedules && schedules.length > 0) {
      const scheduleIds = schedules.map(s => s.id)

      const { data: executions } = await serviceClient
        .from('schedule_executions')
        .select('id')
        .eq('status', 'completed')
        .in('schedule_id', scheduleIds)
        .limit(1)

      if (executions && executions.length > 0) {
        throw new Error('이 항목은 실행 기록이 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.')
      }

      // 3. 관련 데이터 삭제 (트리거 수정으로 단순화)
      // notifications 먼저 삭제 (schedule 참조)
      await serviceClient
        .from('notifications')
        .delete()
        .in('schedule_id', scheduleIds)
    }

    // schedules 삭제 (트리거가 DELETE를 로깅하지 않음)
    await serviceClient
      .from('schedules')
      .delete()
      .eq('item_id', id)

    // 3. item 삭제
    const { error: deleteError } = await serviceClient
      .from('items')
      .delete()
      .eq('id', id)

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