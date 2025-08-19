import { mapErrorToUserMessage, isNetworkError, isAuthError, isDuplicateError, isValidationError } from '../error-mapper'

describe('Error Mapper Utility', () => {
  describe('mapErrorToUserMessage', () => {
    it('should handle null/undefined errors', () => {
      expect(mapErrorToUserMessage(null)).toBe('알 수 없는 오류가 발생했습니다.')
      expect(mapErrorToUserMessage(undefined)).toBe('알 수 없는 오류가 발생했습니다.')
    })

    it('should handle network errors', () => {
      const networkError = new Error('Network request failed')
      expect(mapErrorToUserMessage(networkError)).toBe('네트워크 연결을 확인해주세요.')
    })

    it('should handle permission/RLS errors', () => {
      const permissionError = new Error('Permission denied by RLS policy')
      expect(mapErrorToUserMessage(permissionError)).toBe('권한이 없습니다. 다시 로그인해주세요.')
    })

    it('should handle duplicate errors', () => {
      const duplicateError = new Error('Duplicate key value violates unique constraint')
      expect(mapErrorToUserMessage(duplicateError)).toBe('이미 존재하는 데이터입니다.')
    })

    it('should handle validation errors', () => {
      const validationError = new Error('Invalid input: required field missing')
      expect(mapErrorToUserMessage(validationError)).toBe('입력값을 확인해주세요.')
    })

    it('should handle not found errors', () => {
      const notFoundError = new Error('Record not found')
      expect(mapErrorToUserMessage(notFoundError)).toBe('요청한 데이터를 찾을 수 없습니다.')
    })

    it('should preserve Korean error messages', () => {
      const koreanError = new Error('환자 등록에 실패했습니다')
      expect(mapErrorToUserMessage(koreanError)).toBe('환자 등록에 실패했습니다')
    })

    it('should handle Supabase error codes', () => {
      const supabaseError = {
        code: '23505',
        message: 'duplicate key value'
      }
      expect(mapErrorToUserMessage(supabaseError)).toBe('이미 존재하는 데이터입니다.')
    })

    it('should provide default message for unknown errors', () => {
      const unknownError = { strange: 'error' }
      expect(mapErrorToUserMessage(unknownError)).toBe('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    })
  })

  describe('Error type checkers', () => {
    it('should correctly identify network errors', () => {
      expect(isNetworkError(new Error('Network failed'))).toBe(true)
      expect(isNetworkError(new Error('Fetch error'))).toBe(true)
      expect(isNetworkError(new Error('Something else'))).toBe(false)
    })

    it('should correctly identify auth errors', () => {
      expect(isAuthError(new Error('Authentication failed'))).toBe(true)
      expect(isAuthError(new Error('Permission denied'))).toBe(true)
      expect(isAuthError({ code: '42501' })).toBe(true)
      expect(isAuthError(new Error('Other error'))).toBe(false)
    })

    it('should correctly identify duplicate errors', () => {
      expect(isDuplicateError(new Error('Duplicate entry'))).toBe(true)
      expect(isDuplicateError(new Error('Already exists'))).toBe(true)
      expect(isDuplicateError({ code: '23505' })).toBe(true)
      expect(isDuplicateError(new Error('Other error'))).toBe(false)
    })

    it('should correctly identify validation errors', () => {
      expect(isValidationError(new Error('Invalid input'))).toBe(true)
      expect(isValidationError(new Error('Validation failed'))).toBe(true)
      expect(isValidationError({ code: '23502' })).toBe(true)
      expect(isValidationError(new Error('Other error'))).toBe(false)
    })
  })
})