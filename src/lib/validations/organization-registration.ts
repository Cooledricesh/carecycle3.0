import { z } from 'zod'

/**
 * Validation Schema for New Organization Registration
 */
export const NewOrgRegistrationSchema = z.object({
  organizationName: z.string().min(2, '기관명은 최소 2자 이상이어야 합니다').max(100),
  organizationDescription: z.string().max(500).optional(),
  requesterName: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').max(50),
  requesterEmail: z.string().email('유효한 이메일 주소를 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
})

export type NewOrgRegistrationInput = z.infer<typeof NewOrgRegistrationSchema>
