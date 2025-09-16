'use client'

type ErrorWithCode = {
  code?: string
  message?: string
}

type ErrorWithDetails = {
  details?: string
  message?: string
}

export function mapErrorToUserMessage(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return '알 수 없는 오류가 발생했습니다.'
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check for specific error patterns
    const message = error.message.toLowerCase()
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return '네트워크 연결을 확인해주세요.'
    }
    
    // Permission/RLS errors
    if (message.includes('permission') || message.includes('policy') || message.includes('rls')) {
      return '권한이 없습니다. 다시 로그인해주세요.'
    }
    
    // Duplicate errors
    if (message.includes('duplicate') || message.includes('unique') || message.includes('already exists')) {
      return '이미 존재하는 데이터입니다.'
    }
    
    // Validation errors
    if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
      return '입력값을 확인해주세요.'
    }
    
    // Not found errors
    if (message.includes('not found') || message.includes('찾을 수 없')) {
      return '요청한 데이터를 찾을 수 없습니다.'
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.'
    }
    
    // Return original message if it's in Korean (already user-friendly)
    if (/[가-힣]/.test(error.message)) {
      return error.message
    }
  }

  // Handle Supabase-specific errors
  const errorObj = error as ErrorWithCode & ErrorWithDetails
  
  if (errorObj.code) {
    switch (errorObj.code) {
      // Supabase Auth errors
      case 'invalid_credentials':
        return '이메일 또는 비밀번호가 올바르지 않습니다.'
      case 'email_not_confirmed':
        return '이메일 인증이 필요합니다.'
      case 'user_already_exists':
        return '이미 등록된 사용자입니다.'
      
      // Supabase Database errors
      case '23505': // unique_violation
        return '이미 존재하는 데이터입니다.'
      case '23503': // foreign_key_violation
        return '참조하는 데이터가 존재하지 않습니다.'
      case '23502': // not_null_violation
        return '필수 입력 항목을 확인해주세요.'
      case '42501': // insufficient_privilege
        return '권한이 없습니다.'
      case 'PGRST116': // not found
        return '데이터를 찾을 수 없습니다.'
      case 'PGRST301': // RLS violation
        return '접근 권한이 없습니다.'
      case '22P02': // invalid_text_representation
        return '데이터 형식이 올바르지 않습니다. 입력값을 확인해주세요.'
      case '22003': // numeric_value_out_of_range
        return '숫자 값이 허용 범위를 벗어났습니다.'
      case '42P10': // prepared_statement_already_exists
        return '일시적인 데이터베이스 오류가 발생했습니다. 다시 시도해주세요.'
      case '23514': // check_violation
        return '데이터 유효성 검사에 실패했습니다. 날짜나 상태값을 확인해주세요.'

      default:
        // If code exists but not mapped, include it for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error('Unmapped error code:', errorObj.code, error)
        }
    }
  }

  // Check for details field (Supabase sometimes uses this)
  if (errorObj.details && typeof errorObj.details === 'string') {
    if (errorObj.details.includes('duplicate')) {
      return '중복된 데이터입니다.'
    }
    if (errorObj.details.includes('violates')) {
      return '데이터 제약 조건을 위반했습니다.'
    }
  }

  // If we have a message field, check it
  if (errorObj.message) {
    // Return Korean messages as-is
    if (/[가-힣]/.test(errorObj.message)) {
      return errorObj.message
    }
    
    // For English messages, try to make them more user-friendly
    if (errorObj.message.length < 100) {
      return '오류가 발생했습니다: ' + errorObj.message
    }
  }

  // Default error message
  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('network') || message.includes('fetch')
  }
  return false
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('auth') || message.includes('permission') || message.includes('policy')
  }
  
  const errorObj = error as ErrorWithCode
  if (errorObj.code) {
    return errorObj.code === '42501' || errorObj.code === 'PGRST301'
  }
  
  return false
}

export function isDuplicateError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('duplicate') || message.includes('unique') || message.includes('already exists')
  }
  
  const errorObj = error as ErrorWithCode
  return errorObj.code === '23505'
}

export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('invalid') || message.includes('validation') || message.includes('required')
  }
  
  const errorObj = error as ErrorWithCode
  return errorObj.code === '23502'
}