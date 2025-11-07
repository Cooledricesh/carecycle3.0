'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider-simple'
import { createClient } from '@/lib/supabase/client'
import { JoinRequestsList } from '@/components/admin/JoinRequestsList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function JoinRequestsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isCheckingRole, setIsCheckingRole] = useState(true)

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setIsCheckingRole(false)
        return
      }

      try {
        const supabase = createClient()
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          setUserRole(null)
        } else {
          setUserRole(profile?.role || null)
        }
      } catch (error) {
        console.error('Error checking user role:', error)
        setUserRole(null)
      } finally {
        setIsCheckingRole(false)
      }
    }

    checkUserRole()
  }, [user])

  // Show loading state while checking auth and role
  if (loading || isCheckingRole) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/auth/signin')
    return null
  }

  // Check if user is admin
  if (userRole !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>관리자만 접근할 수 있는 페이지입니다</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              이 페이지는 관리자 권한이 필요합니다. 대시보드로 돌아가세요.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">가입 요청 관리</h1>
        <p className="text-muted-foreground">
          조직 가입 요청을 검토하고 승인 또는 거부하세요
        </p>
      </div>

      <JoinRequestsList />
    </div>
  )
}
