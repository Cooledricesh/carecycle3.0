'use server'

import { NextResponse } from 'next/server'

export type ApiSuccessResponse<T = any> = {
  success: true
  data: T
  message?: string
  metadata?: {
    timestamp: string
    version?: string
    pagination?: {
      page: number
      limit: number
      total: number
      hasNext: boolean
      hasPrevious: boolean
    }
  }
}

export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    path?: string
    statusCode: number
  }
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

export class ApiResponseBuilder {
  static success<T>(
    data: T,
    message?: string,
    metadata?: Omit<ApiSuccessResponse['metadata'], 'timestamp'>
  ): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json({
      success: true,
      data,
      message,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    })
  }

  static error(
    statusCode: number,
    code: string,
    message: string,
    details?: any,
    path?: string
  ): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          details,
          timestamp: new Date().toISOString(),
          path,
          statusCode,
        },
      },
      { status: statusCode }
    )
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): NextResponse<ApiSuccessResponse<T[]>> {
    return ApiResponseBuilder.success(data, message, {
      pagination: {
        page,
        limit,
        total,
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    })
  }
}

export const apiErrors = {
  badRequest: (message = 'Bad Request', details?: any) =>
    ApiResponseBuilder.error(400, 'BAD_REQUEST', message, details),
  
  unauthorized: (message = 'Unauthorized') =>
    ApiResponseBuilder.error(401, 'UNAUTHORIZED', message),
  
  forbidden: (message = 'Forbidden') =>
    ApiResponseBuilder.error(403, 'FORBIDDEN', message),
  
  notFound: (message = 'Resource not found') =>
    ApiResponseBuilder.error(404, 'NOT_FOUND', message),
  
  conflict: (message = 'Resource conflict', details?: any) =>
    ApiResponseBuilder.error(409, 'CONFLICT', message, details),
  
  validation: (message = 'Validation failed', details?: any) =>
    ApiResponseBuilder.error(422, 'VALIDATION_ERROR', message, details),
  
  rateLimit: (message = 'Too many requests') =>
    ApiResponseBuilder.error(429, 'RATE_LIMIT_EXCEEDED', message),
  
  serverError: (message = 'Internal server error', details?: any) =>
    ApiResponseBuilder.error(500, 'INTERNAL_SERVER_ERROR', message, details),
  
  serviceUnavailable: (message = 'Service unavailable') =>
    ApiResponseBuilder.error(503, 'SERVICE_UNAVAILABLE', message),
}

export function handleApiError(error: any, path?: string): NextResponse<ApiErrorResponse> {
  console.error(`API Error at ${path}:`, error)
  
  // Supabase errors
  if (error?.code) {
    switch (error.code) {
      case '42501':
        return apiErrors.forbidden('Insufficient permissions')
      case '23505':
        return apiErrors.conflict('Resource already exists', error.details)
      case 'PGRST116':
        return apiErrors.notFound()
      case '22P02':
        return apiErrors.badRequest('Invalid input format', error.details)
      default:
        return apiErrors.serverError(error.message || 'Database error', error.code)
    }
  }
  
  // Zod validation errors
  if (error?.issues) {
    return apiErrors.validation('Validation failed', error.issues)
  }
  
  // Custom application errors
  if (error instanceof Error) {
    if (error.message.includes('Authentication required')) {
      return apiErrors.unauthorized()
    }
    if (error.message.includes('Admin access required')) {
      return apiErrors.forbidden()
    }
    if (error.message.includes('not found')) {
      return apiErrors.notFound(error.message)
    }
  }
  
  // Default error
  return apiErrors.serverError(
    error?.message || 'An unexpected error occurred',
    process.env.NODE_ENV === 'development' ? error : undefined
  )
}