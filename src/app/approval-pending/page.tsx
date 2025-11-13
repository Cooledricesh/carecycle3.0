'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Mail, AlertCircle, LogOut } from 'lucide-react'
import { ApprovalStatusBadge } from '@/components/shared/approval-status-badge'
import { getOrganizationRequestByUserId } from '@/services/organization-registration'

interface OrganizationRequest {
  id: string
  organization_name: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  created_at: string
  reviewed_at?: string | null
}

function ApprovalPendingContent() {
  const [request, setRequest] = useState<OrganizationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Effect for checking initial request status
  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/signin')
          return
        }

        const data = await getOrganizationRequestByUserId(user.id)

        if (!data) {
          setError('등록 신청 정보를 찾을 수 없습니다')
          setLoading(false)
          return
        }

        setRequest(data)

        // If approved, redirect to signin
        if (data.status === 'approved') {
          setTimeout(() => {
            router.push('/auth/signin?approved=true')
          }, 3000)
        }
      } catch (err) {
        console.error('Failed to fetch request:', err)
        setError('정보를 불러오는 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [router, supabase])

  // Real-time subscription for status updates
  useEffect(() => {
    if (!request?.id) return

    const channel = supabase
      .channel(`org-request-${request.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organization_requests',
        filter: `id=eq.${request.id}`,
      }, (payload) => {
        const updated = payload.new as OrganizationRequest
        setRequest(updated)

        // Auto redirect on approval
        if (updated.status === 'approved') {
          setTimeout(() => {
            router.push('/auth/signin?approved=true')
          }, 3000)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [request?.id, router, supabase])

  // Polling fallback (30 seconds interval)
  useEffect(() => {
    if (!request?.id) return

    const pollInterval = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const data = await getOrganizationRequestByUserId(user.id)
        if (data) {
          setRequest(data)

          if (data.status === 'approved') {
            clearInterval(pollInterval)
            setTimeout(() => {
              router.push('/auth/signin?approved=true')
            }, 3000)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 30000) // 30 seconds

    return () => {
      clearInterval(pollInterval)
    }
  }, [request?.id, router, supabase])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/signin')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Clock className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-lg">로딩 중...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-center">오류 발생</CardTitle>
            <CardDescription className="text-center">
              {error || '요청 정보를 찾을 수 없습니다'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push('/auth/signup')}
              className="w-full"
            >
              가입 페이지로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Clock className="h-16 w-16 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold">
            승인 대기 중
          </CardTitle>
          <CardDescription className="text-base mt-2">
            신규 기관 등록 신청이 접수되었습니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Request Information */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-gray-900">신청 정보</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">기관명:</span> {request.organization_name}</p>
              <p><span className="font-medium">이름:</span> {request.requester_name}</p>
              <p><span className="font-medium">이메일:</span> {request.requester_email}</p>
              <p><span className="font-medium">신청일:</span> {new Date(request.created_at).toLocaleDateString('ko-KR')}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">상태:</span>
                <ApprovalStatusBadge status={request.status} size="sm" />
              </p>
            </div>
          </div>

          {/* Status-specific Messages */}
          {request.status === 'pending' && (
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <h4 className="font-semibold mb-2">검토 진행 중</h4>
                <p className="text-sm mb-2">
                  프로그램 관리자가 등록 신청을 검토하고 있습니다.
                  승인이 완료되면 등록하신 이메일로 안내 메일을 보내드립니다.
                </p>
                <p className="text-sm">
                  2~3일 이내에 답변이 오지 않는다면{' '}
                  <a
                    href="mailto:carescheduler7@gmail.com"
                    className="font-semibold underline"
                  >
                    carescheduler7@gmail.com
                  </a>
                  으로 연락 주시기 바랍니다.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {request.status === 'approved' && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <h4 className="font-semibold mb-2">승인 완료!</h4>
                <p className="text-sm">
                  신청이 승인되었습니다. 잠시 후 로그인 페이지로 이동합니다.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {request.status === 'rejected' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <h4 className="font-semibold mb-2">신청 거부됨</h4>
                <p className="text-sm mb-2">
                  죄송합니다. 신청이 거부되었습니다.
                </p>
                {request.rejection_reason && (
                  <p className="text-sm">
                    <span className="font-medium">거부 사유:</span> {request.rejection_reason}
                  </p>
                )}
                <p className="text-sm mt-2">
                  자세한 내용은{' '}
                  <a
                    href="mailto:carescheduler7@gmail.com"
                    className="font-semibold underline"
                  >
                    carescheduler7@gmail.com
                  </a>
                  으로 문의해주세요.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Contact Information */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <h4 className="font-semibold mb-2">문의하기</h4>
              <p>
                신청 상태나 기타 문의 사항이 있으신 경우{' '}
                <a
                  href="mailto:carescheduler7@gmail.com"
                  className="font-semibold text-blue-600 underline"
                >
                  carescheduler7@gmail.com
                </a>
                으로 연락 주시기 바랍니다.
              </p>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          {request.status === 'approved' && (
            <Button
              onClick={() => router.push('/auth/signin')}
              className="w-full"
            >
              로그인하러 가기
            </Button>
          )}

          {request.status === 'rejected' && (
            <Button
              variant="outline"
              onClick={() => router.push('/auth/signup')}
              className="w-full"
            >
              다시 신청하기
            </Button>
          )}

          {request.status === 'pending' && (
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ApprovalPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Clock className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ApprovalPendingContent />
    </Suspense>
  )
}
