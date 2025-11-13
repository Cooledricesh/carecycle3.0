'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { NewOrgRegistrationSchema, type NewOrgRegistrationInput } from '@/lib/validations/organization-registration'

/**
 * Submit new organization registration request
 *
 * @critical 보안 원칙:
 * - Step 1: Supabase Auth로 사용자 생성 (email_confirm = false, pending_organization status)
 * - Step 2: organization_requests 테이블에 requester_user_id와 함께 저장
 * - 비밀번호는 auth.users에만 저장, organization_requests에는 저장 안함
 */
export async function submitOrganizationRequest(
  input: NewOrgRegistrationInput
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Validate input
    const validated = NewOrgRegistrationSchema.parse(input)

    const supabase = await createServiceClient()

    // Step 1: Create auth user with Supabase Auth (unconfirmed email, pending status)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: validated.requesterEmail,
      password: validated.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approval-pending`,
        data: {
          name: validated.requesterName,
          approval_status: 'pending_organization',
        },
      },
    })

    if (signUpError || !signUpData.user) {
      console.error('Failed to create auth user:', signUpError)

      // Handle duplicate email
      if (signUpError?.message?.includes('already registered')) {
        return {
          success: false,
          error: '이미 등록된 이메일 주소입니다.',
        }
      }

      return {
        success: false,
        error: '사용자 계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
      }
    }

    // Step 2: Check duplicate organization name
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .ilike('name', validated.organizationName)
      .eq('is_active', true)
      .single()

    if (existingOrg) {
      // Rollback: Delete created user
      await supabase.auth.admin.deleteUser(signUpData.user.id)

      return {
        success: false,
        error: '이미 존재하는 기관명입니다. 다른 이름을 사용해주세요.',
      }
    }

    // Step 3: Insert organization request
    const { data: insertData, error: insertError } = await (supabase
      .from('organization_requests') as any)
      .insert({
        organization_name: validated.organizationName,
        organization_description: validated.organizationDescription || null,
        requester_user_id: signUpData.user.id,
        requester_email: validated.requesterEmail,
        requester_name: validated.requesterName,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to submit request:', insertError)

      // Rollback: Delete created user
      await supabase.auth.admin.deleteUser(signUpData.user.id)

      return {
        success: false,
        error: '요청 제출에 실패했습니다. 잠시 후 다시 시도해주세요.',
      }
    }

    return {
      success: true,
      requestId: insertData.id,
    }
  } catch (error) {
    console.error('Organization request error:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }

    return {
      success: false,
      error: '알 수 없는 오류가 발생했습니다.',
    }
  }
}

/**
 * Get organization request by user ID
 */
export async function getOrganizationRequestByUserId(
  userId: string
): Promise<{
  id: string
  organization_name: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  created_at: string
  reviewed_at?: string | null
} | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('organization_requests')
    .select('id, organization_name, requester_name, requester_email, status, rejection_reason, created_at, reviewed_at')
    .eq('requester_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Get organization request by email (legacy support)
 */
export async function getOrganizationRequestByEmail(
  email: string
): Promise<{
  id: string
  organization_name: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  created_at: string
  reviewed_at?: string | null
} | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('organization_requests')
    .select('id, organization_name, requester_name, requester_email, status, rejection_reason, created_at, reviewed_at')
    .eq('requester_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}
