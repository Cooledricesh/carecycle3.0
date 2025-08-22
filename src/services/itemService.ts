'use client'

import { createClient } from '@/lib/supabase/client'
import { 
  ItemCreateSchema, 
  ItemUpdateSchema,
  type ItemCreateInput,
  type ItemUpdateInput 
} from '@/schemas/item'
import type { Item } from '@/types/item'
import { toCamelCase, toSnakeCase } from '@/lib/database-utils'

const supabase = createClient()

export const itemService = {
  async create(input: ItemCreateInput): Promise<Item> {
    try {
      const validated = ItemCreateSchema.parse(input)
      const snakeData = toSnakeCase(validated)
      
      const { data, error } = await supabase
        .from('items')
        .insert(snakeData)
        .select()
        .single()
      
      if (error) throw error
      return toCamelCase(data) as Item
    } catch (error) {
      console.error('Error creating item:', error)
      throw new Error('항목 등록에 실패했습니다')
    }
  },

  async getAll(): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      return (data || []).map(item => toCamelCase(item) as Item)
    } catch (error) {
      console.error('Error fetching items:', error)
      throw new Error('항목 목록 조회에 실패했습니다')
    }
  },

  async getByCategory(category: string): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      
      if (error) throw error
      return (data || []).map(item => toCamelCase(item) as Item)
    } catch (error) {
      console.error('Error fetching items by category:', error)
      throw new Error('카테고리별 항목 조회에 실패했습니다')
    }
  },

  async getById(id: string): Promise<Item | null> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      
      return toCamelCase(data) as Item
    } catch (error) {
      console.error('Error fetching item:', error)
      throw new Error('항목 정보 조회에 실패했습니다')
    }
  },

  async getByCode(code: string): Promise<Item | null> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('code', code)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      
      return toCamelCase(data) as Item
    } catch (error) {
      console.error('Error fetching item by code:', error)
      throw new Error('항목 코드 조회에 실패했습니다')
    }
  },

  async update(id: string, input: ItemUpdateInput): Promise<Item> {
    try {
      const validated = ItemUpdateSchema.parse(input)
      const snakeData = toSnakeCase(validated)
      
      const { data, error } = await supabase
        .from('items')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return toCamelCase(data) as Item
    } catch (error) {
      console.error('Error updating item:', error)
      throw new Error('항목 정보 수정에 실패했습니다')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('items')
        .update({ is_active: false })
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting item:', error)
      throw new Error('항목 삭제에 실패했습니다')
    }
  }
}