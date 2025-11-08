import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiResponseBuilder, handleApiError } from '@/lib/api/response'
import { rateLimitMiddleware, rateLimitPresets } from '@/lib/api/rate-limit'
import { z } from 'zod'
import type { Database } from '@/lib/database.types'

const updateScheduleSchema = z.object({
  intervalType: z.enum(['days', 'weeks', 'months']).optional(),
  intervalValue: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  notes: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, rateLimitPresets.standard)
    if (rateLimitResult) return rateLimitResult
    
    const { id } = await params
    
    if (!z.string().uuid().safeParse(id).success) {
      return ApiResponseBuilder.error(400, 'INVALID_ID', 'Invalid schedule ID format')
    }
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('schedules')
      .select('*, patients(name, patient_number), items(name, category), events(*)')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return ApiResponseBuilder.error(404, 'NOT_FOUND', 'Schedule not found')
      }
      throw error
    }
    
    return ApiResponseBuilder.success(data, 'Schedule retrieved successfully')
  } catch (error) {
    return handleApiError(error, request.url)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, rateLimitPresets.strict)
    if (rateLimitResult) return rateLimitResult
    
    const { id } = await params
    
    if (!z.string().uuid().safeParse(id).success) {
      return ApiResponseBuilder.error(400, 'INVALID_ID', 'Invalid schedule ID format')
    }
    
    const body = await request.json()
    const validated = updateScheduleSchema.parse(body)
    
    const supabase = await createClient()
    
    // Check if schedule exists
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('id', id)
      .single()
    
    if (!existing) {
      return ApiResponseBuilder.error(404, 'NOT_FOUND', 'Schedule not found')
    }
    
    // Update schedule
    const { data, error } = await (supabase as any)
      .from('schedules')
      .update({
        interval_type: validated.intervalType,
        interval_value: validated.intervalValue,
        start_date: validated.startDate,
        end_date: validated.endDate,
        status: validated.status,
        notes: validated.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, patients(name, patient_number), items(name, category)')
      .single()
    
    if (error) throw error
    
    return ApiResponseBuilder.success(data, 'Schedule updated successfully')
  } catch (error) {
    return handleApiError(error, request.url)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, rateLimitPresets.strict)
    if (rateLimitResult) return rateLimitResult
    
    const { id } = await params
    
    if (!z.string().uuid().safeParse(id).success) {
      return ApiResponseBuilder.error(400, 'INVALID_ID', 'Invalid schedule ID format')
    }
    
    const supabase = await createClient()
    
    // Soft delete by updating status
    const { error } = await (supabase as any)
      .from('schedules')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    
    if (error) {
      if (error.code === 'PGRST116') {
        return ApiResponseBuilder.error(404, 'NOT_FOUND', 'Schedule not found')
      }
      throw error
    }
    
    return ApiResponseBuilder.success(null, 'Schedule deleted successfully')
  } catch (error) {
    return handleApiError(error, request.url)
  }
}