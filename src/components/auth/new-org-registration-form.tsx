'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, User, Mail, Lock, AlertCircle } from 'lucide-react'
import { submitOrganizationRequest } from '@/services/organization-registration'
import { NewOrgRegistrationSchema, type NewOrgRegistrationInput } from '@/lib/validations/organization-registration'

export function NewOrgRegistrationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<NewOrgRegistrationInput>({
    resolver: zodResolver(NewOrgRegistrationSchema),
    defaultValues: {
      organizationName: '',
      organizationDescription: '',
      requesterName: '',
      requesterEmail: '',
      password: '',
      passwordConfirm: '',
    },
  })

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
                        <Input placeholder="예: 서울병원" {...field} />
                      </FormControl>
                      <FormDescription>
                        정식 기관 명칭을 입력하세요
                      </FormDescription>
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

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
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
