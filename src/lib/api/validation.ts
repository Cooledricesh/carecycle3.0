import { NextRequest } from 'next/server'
import { z, ZodSchema } from 'zod'
import { apiErrors } from './response'

export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    const body = await request.json()
    const validated = schema.parse(body)
    return validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw apiErrors.validation('Request validation failed', error.errors)
    }
    throw apiErrors.badRequest('Invalid request body')
  }
}

export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T {
  try {
    const params: Record<string, any> = {}
    searchParams.forEach((value, key) => {
      // Handle arrays (multiple values for same key)
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value)
        } else {
          params[key] = [params[key], value]
        }
      } else {
        params[key] = value
      }
    })
    
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw apiErrors.validation('Query parameter validation failed', error.errors)
    }
    throw apiErrors.badRequest('Invalid query parameters')
  }
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
})

export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  fields: z.array(z.string()).optional(),
})