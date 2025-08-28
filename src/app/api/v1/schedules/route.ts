import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiResponseBuilder, handleApiError } from '@/lib/api/response'
import { validateQueryParams, paginationSchema } from '@/lib/api/validation'
import { rateLimitMiddleware, rateLimitPresets } from '@/lib/api/rate-limit'
import { z } from 'zod'

const scheduleFilterSchema = paginationSchema.extend({
  patientId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

const createScheduleSchema = z.object({
  patientId: z.string().uuid(),
  itemId: z.string().uuid(),
  intervalType: z.enum(['days', 'weeks', 'months']),
  intervalValue: z.number().int().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, rateLimitPresets.standard)
    if (rateLimitResult) return rateLimitResult
    
    const searchParams = request.nextUrl.searchParams
    const filters = validateQueryParams(searchParams, scheduleFilterSchema)
    
    const supabase = await createClient()
    
    // Build query
    let query = supabase
      .from('schedules')
      .select('*, patients(name, patient_number), items(name, category)', { count: 'exact' })
    
    // Apply filters
    if (filters.patientId) {
      query = query.eq('patient_id', filters.patientId)
    }
    if (filters.itemId) {
      query = query.eq('item_id', filters.itemId)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('start_date', filters.endDate)
    }
    
    // Apply pagination
    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 10)
    const to = from + (filters.limit ?? 10) - 1
    query = query.range(from, to)
    
    // Apply sorting
    query = query.order(filters.sort || 'created_at', { ascending: filters.order === 'asc' })
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return ApiResponseBuilder.paginated(
      data || [],
      filters.page ?? 1,
      filters.limit ?? 10,
      count || 0,
      'Schedules retrieved successfully'
    )
  } catch (error) {
    return handleApiError(error, request.url)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, rateLimitPresets.strict)
    if (rateLimitResult) return rateLimitResult
    
    const body = await request.json()
    const validated = createScheduleSchema.parse(body)
    
    const supabase = await createClient()
    
    // Check if patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', validated.patientId)
      .single()
    
    if (patientError || !patient) {
      return ApiResponseBuilder.error(404, 'NOT_FOUND', 'Patient not found')
    }
    
    // Check if item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id')
      .eq('id', validated.itemId)
      .single()
    
    if (itemError || !item) {
      return ApiResponseBuilder.error(404, 'NOT_FOUND', 'Item not found')
    }
    
    // Create schedule
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        patient_id: validated.patientId,
        item_id: validated.itemId,
        interval_type: validated.intervalType,
        interval_value: validated.intervalValue,
        start_date: validated.startDate,
        end_date: validated.endDate,
        notes: validated.notes,
        status: 'active',
      })
      .select('*, patients(name, patient_number), items(name, category)')
      .single()
    
    if (error) throw error
    
    return ApiResponseBuilder.success(data, 'Schedule created successfully')
  } catch (error) {
    return handleApiError(error, request.url)
  }
}