'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const organizationNameSchema = z.string()
  .min(2, '조직 이름은 최소 2자 이상이어야 합니다')
  .max(100, '조직 이름은 최대 100자까지 가능합니다')
  .trim()

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (organizationId: string, organizationName: string) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess
}: CreateOrganizationDialogProps) {
  const [organizationName, setOrganizationName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setValidationError(null)

    // Validate organization name
    const validation = organizationNameSchema.safeParse(organizationName)
    if (!validation.success) {
      setValidationError(validation.error.errors[0].message)
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Get current session (more reliable right after signup than getUser)
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session?.user) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.')
      }

      const user = session.user

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, organization_id')
        .eq('id', user.id)
        .single<{ id: string; name: string | null; organization_id: string | null }>()

      if (profileError || !profile) {
        throw new Error('사용자 정보를 가져올 수 없습니다')
      }

      if (profile.organization_id) {
        throw new Error('이미 조직에 소속되어 있습니다')
      }

      // Call RPC function to create organization and register user
      const { data: organizationId, error: rpcError } = await supabase.rpc(
        'create_organization_and_register_user',
        {
          p_organization_name: validation.data,
          p_user_id: user.id,
          p_user_name: profile.name,
          p_user_role: 'admin'
        } as any
      ) as { data: string | null; error: any }

      if (rpcError) {
        console.error('RPC error:', rpcError)
        // Handle duplicate organization name
        if (rpcError.code === '23505' || rpcError.message?.includes('duplicate')) {
          throw new Error('이미 존재하는 조직 이름입니다')
        }
        throw new Error('조직 생성에 실패했습니다')
      }

      if (!organizationId) {
        throw new Error('조직 ID를 받지 못했습니다')
      }

      // Success - notify parent component
      onSuccess(organizationId, validation.data)
      onOpenChange(false)
      setOrganizationName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '조직 생성에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      // Reset form when closing
      setOrganizationName('')
      setError(null)
      setValidationError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>새로운 조직 생성</DialogTitle>
          <DialogDescription>
            새로운 조직을 생성하고 관리자로 등록됩니다
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="organization-name">조직 이름</Label>
              <Input
                id="organization-name"
                placeholder="예: 서울대학교병원"
                value={organizationName}
                onChange={(e) => {
                  setOrganizationName(e.target.value)
                  setValidationError(null)
                  setError(null)
                }}
                disabled={isLoading}
                required
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '생성 중...' : '조직 생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
