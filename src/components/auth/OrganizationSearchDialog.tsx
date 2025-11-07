'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Building2, Users } from 'lucide-react'

interface Organization {
  id: string
  name: string
  member_count: number
}

interface OrganizationSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOrganization: (organizationId: string) => void
  onCreateNew: () => void
}

export function OrganizationSearchDialog({
  open,
  onOpenChange,
  onSelectOrganization,
  onCreateNew
}: OrganizationSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setOrganizations([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/organizations/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search_term: searchQuery,
            limit: 10,
          }),
        })

        if (!response.ok) {
          throw new Error('조직 검색에 실패했습니다')
        }

        const result = await response.json()
        setOrganizations(result.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '조직 검색에 실패했습니다')
        setOrganizations([])
      } finally {
        setIsLoading(false)
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSelectOrganization = (organizationId: string) => {
    onSelectOrganization(organizationId)
    onOpenChange(false)
  }

  const handleCreateNew = () => {
    onOpenChange(false)
    onCreateNew()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>조직 선택</DialogTitle>
          <DialogDescription>
            소속될 조직을 검색하거나 새로운 조직을 생성하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="조직 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              검색 중...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-4 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Organization List */}
          {!isLoading && !error && organizations.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrganization(org.id)}
                  className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{org.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{org.member_count}명</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && !error && searchQuery.trim() && organizations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              검색 결과가 없습니다
            </div>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              조직 이름을 입력하여 검색하세요
            </div>
          )}

          {/* Create New Organization Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleCreateNew}
              variant="outline"
              className="w-full"
            >
              <Building2 className="mr-2 h-4 w-4" />
              새로운 조직 생성하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
