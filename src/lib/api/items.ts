'use client'

import { createClient } from '@/lib/supabase/client'
import type { Item, ItemInsert, ItemUpdate } from '@/lib/database.types'
import { deleteItemAction } from '@/app/actions/items'

export async function getItems(organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching items:', error)
    throw error
  }

  return data
}

export async function getAllItems(organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching all items:', error)
    throw error
  }

  return data
}

export async function getItemById(id: string, organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    console.error('Error fetching item:', error)
    throw error
  }

  return data
}

async function generateItemCode(category: string, organizationId: string): Promise<string> {
  const supabase = createClient()

  // 카테고리별 접두사 설정
  const prefix = {
    'injection': 'INJ',
    'test': 'TST',
    'other': 'OTH'
  }[category] || 'ITM'

  // 해당 조직 내 카테고리의 마지막 코드 찾기
  const { data } = await (supabase as any)
          .from('items')
    .select('code')
    .eq('organization_id', organizationId)
    .like('code', `${prefix}%`)
    .order('code', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (data && data.length > 0) {
    const lastCode = data[0].code
    const lastNumber = parseInt(lastCode.replace(prefix, ''), 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`
}

export async function createItem(item: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>, organizationId: string) {
  const supabase = createClient()

  // 코드 자동 생성 (조직별)
  const code = await generateItemCode(item.category, organizationId)

  const { data, error } = await (supabase as any)
          .from('items')
    .insert({
      ...item,
      code,
      organization_id: organizationId,
      is_active: item.is_active ?? true,
      requires_notification: item.requires_notification ?? true,
      notification_days_before: item.notification_days_before ?? 7,
      default_interval_weeks: item.default_interval_weeks ?? 4,
      sort_order: item.sort_order ?? 0,
      metadata: item.metadata ?? {}
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating item:', error)
    throw error
  }

  return data
}

export async function updateItem(id: string, updates: ItemUpdate, organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('Error updating item:', error)
    throw error
  }

  return data
}

export async function deleteItem(id: string) {
  // 서버 액션 호출 (관리자 권한 확인 및 실행 기록 체크 포함)
  return await deleteItemAction(id)
}

export async function toggleItemStatus(id: string, isActive: boolean, organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('Error toggling item status:', error)
    throw error
  }

  return data
}

export async function getItemsByCategory(category: string, organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .select('*')
    .eq('category', category)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching items by category:', error)
    throw error
  }

  return data
}

export async function searchItems(searchTerm: string, organizationId: string) {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
          .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error searching items:', error)
    throw error
  }

  return data
}