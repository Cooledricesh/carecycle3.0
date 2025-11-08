'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus
} from '@/lib/api/items'
import type { Item, ItemInsert } from '@/lib/database.types'
import { mapErrorToUserMessage } from '@/lib/error-mapper'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'
import { useProfile, Profile } from '@/hooks/useProfile'

export function useItemMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  /**
   * 아이템 생성 뮤테이션
   */
  const createMutation = useMutation({
    mutationFn: (data: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return createItem(data, typedProfile.organization_id)
    },
    onSuccess: () => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast({
        title: '항목 추가 완료',
        description: '새 항목이 성공적으로 추가되었습니다.',
      })
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '항목 추가 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  /**
   * 아이템 수정 뮤테이션
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return updateItem(id, data, typedProfile.organization_id)
    },
    onMutate: async ({ id, data }) => {
      // 낙관적 업데이트
      await queryClient.cancelQueries({ queryKey: ['items'] })

      const previousItems = queryClient.getQueryData<Item[]>(['items'])

      if (previousItems) {
        queryClient.setQueryData<Item[]>(['items'], old =>
          old?.map(item =>
            item.id === id ? { ...item, ...data } : item
          ) ?? []
        )
      }

      return { previousItems }
    },
    onSuccess: () => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast({
        title: '항목 수정 완료',
        description: '항목이 성공적으로 수정되었습니다.',
      })
    },
    onError: (error, _, context) => {
      // 낙관적 업데이트 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems)
      }

      const message = mapErrorToUserMessage(error)
      toast({
        title: '항목 수정 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  /**
   * 아이템 삭제 뮤테이션
   */
  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onMutate: async (id: string) => {
      // 낙관적 업데이트
      await queryClient.cancelQueries({ queryKey: ['items'] })

      const previousItems = queryClient.getQueryData<Item[]>(['items'])

      if (previousItems) {
        queryClient.setQueryData<Item[]>(['items'], old =>
          old?.filter(item => item.id !== id) ?? []
        )
      }

      return { previousItems }
    },
    onSuccess: () => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast({
        title: '항목 삭제 완료',
        description: '항목이 성공적으로 삭제되었습니다.',
      })
    },
    onError: (error, _, context) => {
      // 낙관적 업데이트 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems)
      }

      const message = mapErrorToUserMessage(error)
      toast({
        title: '항목 삭제 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  /**
   * 아이템 상태 토글 뮤테이션
   */
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return toggleItemStatus(id, isActive, typedProfile.organization_id)
    },
    onMutate: async ({ id, isActive }) => {
      // 낙관적 업데이트
      await queryClient.cancelQueries({ queryKey: ['items'] })

      const previousItems = queryClient.getQueryData<Item[]>(['items'])

      if (previousItems) {
        queryClient.setQueryData<Item[]>(['items'], old =>
          old?.map(item =>
            item.id === id ? { ...item, is_active: isActive } : item
          ) ?? []
        )
      }

      return { previousItems }
    },
    onSuccess: (_, variables) => {
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast({
        title: '상태 변경 완료',
        description: `항목이 ${variables.isActive ? '활성화' : '비활성화'}되었습니다.`,
      })
    },
    onError: (error, _, context) => {
      // 낙관적 업데이트 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems)
      }

      const message = mapErrorToUserMessage(error)
      toast({
        title: '상태 변경 실패',
        description: message,
        variant: 'destructive'
      })
    }
  })

  return {
    createItem: createMutation.mutate,
    createItemAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateItem: updateMutation.mutate,
    updateItemAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteItem: deleteMutation.mutate,
    deleteItemAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,

    toggleItemStatus: toggleStatusMutation.mutate,
    toggleItemStatusAsync: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,
  }
}