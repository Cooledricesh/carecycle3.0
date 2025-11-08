'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
      const response = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: validation.data
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle duplicate name error
        if (response.status === 409) {
          throw new Error('이미 존재하는 조직 이름입니다')
        }
        throw new Error(data.error || '조직 생성에 실패했습니다')
      }

      // Success - notify parent component
      // API returns { data: { organization_id, profile } }
      const organizationId = data.data?.organization_id || data.organization_id
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
