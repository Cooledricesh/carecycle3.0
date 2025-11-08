'use client'

import { useState } from 'react'
import { Plus, Search, Filter, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn, touchTarget, responsiveText, responsivePadding } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useItems } from '@/hooks/useItems'
import { useItemMutations } from '@/hooks/useItemMutations'
import { useItemFilters } from '@/hooks/useItemFilters'
import { ItemCard } from './items/ItemCard'
import { ItemTable } from './items/ItemTable'
import { ItemForm } from './items/ItemForm'
import type { Item, ItemInsert } from '@/lib/database.types'

export function ItemsManager() {
  const isMobile = useIsMobile()

  // Business Logic Hooks
  const { items, isLoading, error, refetch } = useItems()
  const { createItem, updateItem, deleteItem, toggleItemStatus, isCreating, isUpdating, isDeleting, isToggling } = useItemMutations()
  const {
    filteredItems,
    filters,
    filterCounts,
    hasActiveFilters,
    setSearchTerm,
    setCategory,
    setStatus,
    resetFilters
  } = useItemFilters(items)

  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Handlers
  const handleAdd = () => {
    setSelectedItem(null)
    setIsFormOpen(true)
  }

  const handleEdit = (item: Item) => {
    setSelectedItem(item)
    setIsFormOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    const item = items.find((i: Item) => i.id === id)
    if (item) {
      setItemToDelete(item)
      setDeleteDialogOpen(true)
    }
  }

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete.id)
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleFormSubmit = (data: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>) => {
    if (selectedItem) {
      updateItem({ id: selectedItem.id, data })
    } else {
      createItem(data)
    }
    setIsFormOpen(false)
    setSelectedItem(null)
  }

  const handleToggleStatus = (id: string, status: boolean) => {
    toggleItemStatus({ id, isActive: status })
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-[180px]" />
          <Skeleton className="h-10 w-full sm:w-[120px]" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">항목을 불러오는 중 오류가 발생했습니다.</p>
        <Button onClick={() => refetch()}>다시 시도</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className={cn(
        "flex gap-3",
        isMobile ? "flex-col" : "flex-row"
      )}>
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={isMobile ? "검색..." : "항목명, 코드, 설명으로 검색..."}
              value={filters.searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn("pl-10", touchTarget.input)}
            />
          </div>
        </div>

        {/* Filters - Mobile */}
        {isMobile ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn("w-full justify-between", touchTarget.button)}
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                필터 {hasActiveFilters && `(${filterCounts.filtered}/${filterCounts.total})`}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                showFilters && "rotate-180"
              )} />
            </Button>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                <Select value={filters.category} onValueChange={setCategory}>
                  <SelectTrigger className={touchTarget.input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 카테고리</SelectItem>
                    <SelectItem value="injection">주사 ({filterCounts.byCategory.injection})</SelectItem>
                    <SelectItem value="test">검사 ({filterCounts.byCategory.test})</SelectItem>
                    <SelectItem value="other">기타 ({filterCounts.byCategory.other})</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.status} onValueChange={setStatus}>
                  <SelectTrigger className={touchTarget.input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="active">활성 ({filterCounts.active})</SelectItem>
                    <SelectItem value="inactive">비활성 ({filterCounts.inactive})</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="col-span-2"
                  >
                    필터 초기화
                  </Button>
                )}
              </div>
            )}

            {/* Add Button - Mobile */}
            <Button
              onClick={handleAdd}
              className={cn("w-full", touchTarget.button)}
            >
              <Plus className="h-4 w-4 mr-2" />
              항목 추가
            </Button>
          </div>
        ) : (
          <>
            {/* Filters - Desktop */}
            <Select value={filters.category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 카테고리</SelectItem>
                <SelectItem value="injection">주사</SelectItem>
                <SelectItem value="test">검사</SelectItem>
                <SelectItem value="other">기타</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Button - Desktop */}
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              항목 추가
            </Button>
          </>
        )}
      </div>

      {/* Filter Status Bar */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700">
            {filterCounts.filtered}개 항목 표시 (전체 {filterCounts.total}개)
          </span>
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-blue-700 hover:text-blue-800"
            >
              필터 초기화
            </Button>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {hasActiveFilters ? '검색 결과가 없습니다.' : '등록된 항목이 없습니다.'}
          </div>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={resetFilters}>
              필터 초기화
            </Button>
          ) : (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              첫 번째 항목 추가
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Items List/Table */}
          {isMobile ? (
            // Mobile: Card Layout
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onToggleStatus={handleToggleStatus}
                  isToggling={isToggling}
                />
              ))}
            </div>
          ) : (
            // Desktop: Table Layout
            <ItemTable
              items={filteredItems}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleStatus={handleToggleStatus}
              isToggling={isToggling}
            />
          )}
        </>
      )}

      {/* Item Form Dialog */}
      <ItemForm
        item={selectedItem}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedItem(null)
        }}
        onSubmit={handleFormSubmit}
        isMobile={isMobile}
        isSubmitting={isCreating || isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{itemToDelete?.name}&quot; 항목을 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false)
                setItemToDelete(null)
              }}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}