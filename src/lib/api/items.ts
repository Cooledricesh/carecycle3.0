'use client'

import { createClient } from '@/lib/supabase/client'
import type { Item, ItemInsert, ItemUpdate } from '@/lib/database.types'

export async function getItems() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
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

export async function getAllItems() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
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

export async function getItemById(id: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching item:', error)
    throw error
  }

  return data
}

async function generateItemCode(category: string): Promise<string> {
  const supabase = createClient()
  
  // 카테고리별 접두사 설정
  const prefix = {
    'injection': 'INJ',
    'test': 'TST',
    'treatment': 'TRT',
    'medication': 'MED',
    'other': 'OTH'
  }[category] || 'ITM'
  
  // 해당 카테고리의 마지막 코드 찾기
  const { data } = await supabase
    .from('items')
    .select('code')
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

export async function createItem(item: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>) {
  const supabase = createClient()
  
  // 코드 자동 생성
  const code = await generateItemCode(item.category)
  
  const { data, error } = await supabase
    .from('items')
    .insert({
      ...item,
      code,
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

export async function updateItem(id: string, updates: ItemUpdate) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating item:', error)
    throw error
  }

  return data
}

export async function deleteItem(id: string) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting item:', error)
    throw error
  }

  return { success: true }
}

export async function toggleItemStatus(id: string, isActive: boolean) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .update({ 
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error toggling item status:', error)
    throw error
  }

  return data
}

export async function getItemsByCategory(category: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching items by category:', error)
    throw error
  }

  return data
}

export async function searchItems(searchTerm: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
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