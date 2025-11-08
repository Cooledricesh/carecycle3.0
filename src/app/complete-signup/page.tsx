'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppIcon } from '@/components/ui/app-icon'
import { OrganizationSearchDialog } from '@/components/auth/OrganizationSearchDialog'
import { CreateOrganizationDialog } from '@/components/auth/CreateOrganizationDialog'
import { Button } from '@/components/ui/button'

export default function CompleteSignupPage() {
  const [showOrgSearch, setShowOrgSearch] = useState(false)
  const [showOrgCreate, setShowOrgCreate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; role: string } | null>(null)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/signin')
        return
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, role, organization_id')
        .eq('id', user.id)
        .single<{ name: string; email: string; role: string; organization_id: string | null }>()

      if (profileError || !profile) {
        setError('프로필 정보를 불러올 수 없습니다.')
        setIsLoading(false)
        return
      }

      // If user already has organization, redirect to dashboard
      if (profile.organization_id) {
        router.push('/dashboard')
        return
      }

      setUserProfile({
        name: profile.name,
        email: profile.email,
        role: profile.role
      })
      setIsLoading(false)
    }

    checkUser()
  }, [router])

  const handleSelectOrganization = async (organizationId: string) => {
    if (!userProfile) return

    setIsLoading(true)
    setError(null)

    try {
      // Create join request
      const response = await fetch('/api/join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          requested_role: userProfile.role,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '가입 요청에 실패했습니다.')
      }

      // Show awaiting approval message
      setAwaitingApproval(true)
      setShowOrgSearch(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '가입 요청에 실패했습니다.')
      setShowOrgSearch(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrganization = async (organizationId: string, organizationName: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // User is automatically assigned as admin when creating organization
      // Just redirect to dashboard
      router.push('/dashboard')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '조직 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (awaitingApproval) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <AppIcon size="xl" />
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl">승인 대기 중</CardTitle>
              <CardDescription>관리자 승인을 기다리고 있습니다</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>가입 요청이 성공적으로 제출되었습니다.</p>
              <p className="mt-2">관리자가 승인하면 이메일로 알림을 받게 됩니다.</p>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => router.push('/auth/signin')}
                className="w-full"
              >
                로그인 페이지로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <AppIcon size="xl" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">회원가입 완료</CardTitle>
            <CardDescription>
              마지막 단계입니다. 조직을 선택하거나 생성하세요.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {userProfile && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="font-medium">이름:</span> {userProfile.name}
              </div>
              <div className="text-sm">
                <span className="font-medium">이메일:</span> {userProfile.email}
              </div>
              <div className="text-sm">
                <span className="font-medium">직군:</span>{' '}
                {userProfile.role === 'nurse' ? '스텝' : userProfile.role === 'doctor' ? '의사' : '관리자'}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <Button
            onClick={() => setShowOrgSearch(true)}
            className="w-full"
            size="lg"
          >
            조직 선택하기
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            조직을 찾을 수 없나요?{' '}
            <button
              onClick={() => {
                setShowOrgSearch(false)
                setShowOrgCreate(true)
              }}
              className="text-primary hover:underline"
            >
              새로 만들기
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Organization Search Dialog */}
      <OrganizationSearchDialog
        open={showOrgSearch}
        onOpenChange={setShowOrgSearch}
        onSelectOrganization={handleSelectOrganization}
        onCreateNew={() => {
          setShowOrgSearch(false)
          setShowOrgCreate(true)
        }}
      />

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showOrgCreate}
        onOpenChange={setShowOrgCreate}
        onSuccess={handleCreateOrganization}
      />
    </div>
  )
}
