'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, User, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { submitOrganizationRequest } from '@/services/organization-registration'
import { NewOrgRegistrationSchema, type NewOrgRegistrationInput } from '@/lib/validations/organization-registration'
import { createClient } from '@/lib/supabase/client'
import { TermsDialog } from '@/components/auth/TermsDialog'
import { PrivacyPolicyDialog } from '@/components/auth/PrivacyPolicyDialog'

export function NewOrgRegistrationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingOrgName, setIsCheckingOrgName] = useState(false)
  const [orgNameError, setOrgNameError] = useState<string | null>(null)
  const [orgNameAvailable, setOrgNameAvailable] = useState(false)

  const form = useForm<NewOrgRegistrationInput>({
    resolver: zodResolver(NewOrgRegistrationSchema),
    defaultValues: {
      organizationName: '',
      organizationDescription: '',
      requesterName: '',
      requesterEmail: '',
      password: '',
      passwordConfirm: '',
      termsAgreed: false,
      privacyPolicyAgreed: false,
    },
  })

  // Check organization name availability
  const checkOrgNameAvailability = useCallback(async (name: string) => {
    if (!name || name.length < 2) {
      setOrgNameError(null)
      setOrgNameAvailable(false)
      return
    }

    setIsCheckingOrgName(true)
    setOrgNameError(null)
    setOrgNameAvailable(false)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', name)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Organization check error:', error)
        return
      }

      if (data) {
        setOrgNameError('이미 존재하는 기관명입니다')
        setOrgNameAvailable(false)
      } else {
        setOrgNameError(null)
        setOrgNameAvailable(true)
      }
    } catch (err) {
      console.error('Organization check error:', err)
    } finally {
      setIsCheckingOrgName(false)
    }
  }, [])

  // Watch terms agreement fields for button state
  const termsAgreed = form.watch('termsAgreed')
  const privacyPolicyAgreed = form.watch('privacyPolicyAgreed')

  const onSubmit = async (data: NewOrgRegistrationInput) => {
    try {
      setIsSubmitting(true)
      setError(null)

      const result = await submitOrganizationRequest(data)

      if (!result.success) {
        setError(result.error || '요청 제출에 실패했습니다.')
        return
      }

      // Redirect to approval pending page
      router.push(`/approval-pending`)
    } catch (err) {
      console.error('Submit error:', err)
      setError('알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            신규 기관 등록 신청
          </CardTitle>
          <CardDescription className="text-center">
            새로운 의료 기관을 등록하고 관리자로 가입합니다
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Organization Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <Building2 className="w-4 h-4" />
                  <span>기관 정보</span>
                </div>

                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기관명 *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="예: oo의원, oo병원"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur()
                              checkOrgNameAvailability(e.target.value)
                            }}
                            onChange={(e) => {
                              field.onChange(e)
                              // Reset validation state on change
                              setOrgNameError(null)
                              setOrgNameAvailable(false)
                            }}
                          />
                          {isCheckingOrgName && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                          )}
                          {!isCheckingOrgName && orgNameAvailable && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        정식 기관 명칭을 입력하세요
                        {isCheckingOrgName && <span className="ml-2 text-blue-600">확인 중...</span>}
                        {orgNameAvailable && <span className="ml-2 text-green-600">사용 가능한 기관명입니다</span>}
                      </FormDescription>
                      {orgNameError && (
                        <p className="text-sm font-medium text-destructive">{orgNameError}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organizationDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기관 설명 (선택)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="기관에 대한 간단한 설명을 입력하세요"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Requester Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <User className="w-4 h-4" />
                  <span>관리자 정보</span>
                </div>

                <FormField
                  control={form.control}
                  name="requesterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름 *</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requesterEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일 *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@hospital.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        승인 알림을 받을 이메일 주소
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pb-2 border-b">
                  <Lock className="w-4 h-4" />
                  <span>비밀번호 설정</span>
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호 *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="최소 8자 이상" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호 확인 *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="비밀번호 재입력" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notice */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>안내사항:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>신청하신 내용은 프로그램 관리자가 검토합니다</li>
                    <li>승인 완료 시 이메일로 안내해드립니다</li>
                    <li>승인까지 보통 2-3일이 소요됩니다</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Terms Agreement */}
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="termsAgreed"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="text-sm font-medium leading-none">
                            <TermsDialog>
                              <button type="button" className="underline hover:text-blue-600">
                                서비스 이용약관
                              </button>
                            </TermsDialog>
                            에 동의합니다 (필수)
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="privacyPolicyAgreed"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="text-sm font-medium leading-none">
                            <PrivacyPolicyDialog>
                              <button type="button" className="underline hover:text-blue-600">
                                개인정보처리방침
                              </button>
                            </PrivacyPolicyDialog>
                            에 동의합니다 (필수)
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !termsAgreed || !privacyPolicyAgreed}
              >
                {isSubmitting ? '제출 중...' : '등록 신청'}
              </Button>

              {/* Back to Login */}
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => router.push('/auth/signin')}
                  type="button"
                >
                  로그인 페이지로 돌아가기
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
