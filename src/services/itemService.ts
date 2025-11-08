'use client'

import { createClient, type SupabaseClient } from '@/lib/supabase/client'
import {
  ItemCreateSchema,
  ItemUpdateSchema,
  type ItemCreateInput,
  type ItemUpdateInput
} from '@/schemas/item'
import type { Item } from '@/types/item'
import { toCamelCase, toSnakeCase } from '@/lib/database-utils'

export const itemService = {
  async create(input: ItemCreateInput, organizationId: string, supabase?: SupabaseClient): Promise<Item> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const validated = ItemCreateSchema.parse(input)
      const snakeData = toSnakeCase({ ...validated, organizationId })

      const { data, error } = await client
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

  async getAll(organizationId: string, supabase?: SupabaseClient): Promise<Item[]> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const { data, error } = await client
        .from('items')
        .select('*')
        .eq('organization_id', organizationId)
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

  async getByCategory(category: string, organizationId: string, supabase?: SupabaseClient): Promise<Item[]> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const { data, error } = await client
        .from('items')
        .select('*')
        .eq('category', category)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data || []).map(item => toCamelCase(item) as Item)
    } catch (error) {
      console.error('Error fetching items by category:', error)
      throw new Error('카테고리별 항목 조회에 실패했습니다')
    }
  },

  async getById(id: string, organizationId: string, supabase?: SupabaseClient): Promise<Item | null> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const { data, error } = await client
        .from('items')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
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

  async getByCode(code: string, organizationId: string, supabase?: SupabaseClient): Promise<Item | null> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const { data, error } = await client
        .from('items')
        .select('*')
        .eq('code', code)
        .eq('organization_id', organizationId)
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

  async update(id: string, input: ItemUpdateInput, organizationId: string, supabase?: SupabaseClient): Promise<Item> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const validated = ItemUpdateSchema.parse(input)
      const snakeData = toSnakeCase(validated)

      const { data, error } = await client
        .from('items')
        .update(snakeData)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) throw error
      return toCamelCase(data) as Item
    } catch (error) {
      console.error('Error updating item:', error)
      throw new Error('항목 정보 수정에 실패했습니다')
    }
  },

  async delete(id: string, organizationId: string, supabase?: SupabaseClient): Promise<void> {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }

    try {
      const client = supabase || createClient()
      const { error } = await client
        .from('items')
        .update({ is_active: false })
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting item:', error)
      throw new Error('항목 삭제에 실패했습니다')
    }
  }
}
