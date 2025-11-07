'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, LogOut } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  approval_status: 'pending' | 'approved' | 'rejected' | null
  is_active: boolean
  created_at: string | null
  updated_at?: string | null
  organization_id?: string
  care_type?: string | null
  phone?: string | null
  approved_at?: string | null
  approved_by?: string | null
  rejection_reason?: string | null
}

export default function ApprovalPendingPage() {
  return <ApprovalPendingPageContent />
}

function ApprovalPendingPageContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Effect for checking initial user status
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/auth/signin')
          return
        }

        // Get user profile with approval status
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
          return
        }

        setProfile(profileData)

        // If user is approved and active, redirect to dashboard
        if (profileData?.approval_status === 'approved' && profileData?.is_active) {
          router.push('/dashboard')
          return
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUserStatus()
  }, [router, supabase])

  // Separate effect for real-time subscription that depends on profile.id
  useEffect(() => {
    // Skip subscription if profile or profile.id is not available
    if (!profile?.id) {
      return
    }

    // Set up real-time subscription for profile changes
    const channel = supabase
      .channel(`profile-changes-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profile.id}`
      }, (payload) => {
        const updatedProfile = payload.new as UserProfile
        setProfile(updatedProfile)
        
        // If approved and activated, redirect to dashboard
        if (updatedProfile.approval_status === 'approved' && updatedProfile.is_active) {
          router.push('/dashboard')
        }
      })
      .subscribe()

    // Cleanup function to unsubscribe when profile.id changes or component unmounts
    return () => {
      channel.unsubscribe()
    }
  }, [profile?.id, router, supabase])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/signin')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const getStatusMessage = () => {
    if (!profile) return { title: 'Loading...', description: '', icon: Clock, variant: 'default' as const }

    switch (profile.approval_status) {
      case 'pending':
        return {
          title: 'Awaiting Approval',
          description: 'Your account has been created successfully, but it needs to be approved by an administrator before you can access the medical scheduling system.',
          icon: Clock,
          variant: 'default' as const
        }
      case 'rejected':
        return {
          title: 'Account Rejected',
          description: 'Unfortunately, your account has been rejected by an administrator. Please contact your supervisor or IT support for assistance.',
          icon: AlertCircle,
          variant: 'destructive' as const
        }
      case 'approved':
        if (!profile.is_active) {
          return {
            title: 'Account Deactivated',
            description: 'Your account has been deactivated by an administrator. Please contact your supervisor or IT support to reactivate your account.',
            icon: AlertCircle,
            variant: 'destructive' as const
          }
        }
        break
    }

    return {
      title: 'Account Status Unknown',
      description: 'There seems to be an issue with your account status. Please contact IT support.',
      icon: AlertCircle,
      variant: 'destructive' as const
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Clock className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-lg">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = getStatusMessage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <status.icon className={`h-16 w-16 ${
              status.variant === 'destructive' ? 'text-red-500' : 'text-blue-500'
            }`} />
          </div>
          <CardTitle className="text-2xl font-bold">
            {status.title}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {status.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {profile && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-gray-900">Account Information</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Name:</span> {profile.name}</p>
                <p><span className="font-medium">Email:</span> {profile.email}</p>
                <p><span className="font-medium">Role:</span> {profile.role}</p>
                <p><span className="font-medium">Registered:</span> {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    profile.approval_status === 'approved' 
                      ? 'bg-green-100 text-green-800'
                      : profile.approval_status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {profile.approval_status ? profile.approval_status.charAt(0).toUpperCase() + profile.approval_status.slice(1) : 'Pending'}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {profile?.approval_status === 'pending' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• An administrator will review your account</li>
                  <li>• You&apos;ll receive an email notification when approved</li>
                  <li>• This page will automatically update when your status changes</li>
                  <li>• Approval typically takes 1-2 business days</li>
                </ul>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Need Help?</h4>
              <p className="text-sm text-yellow-700">
                If you have questions about your account status, please contact:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• Your department supervisor</li>
                <li>• IT Support: staff@hospital.com</li>
                <li>• Hospital Administration</li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}