'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Search, Filter, MoreVertical } from 'lucide-react'
import { 
  getAllItems, 
  createItem, 
  updateItem, 
  deleteItem, 
  toggleItemStatus 
} from '@/lib/api/items'
import type { Item, ItemInsert } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'

export function ItemsManager() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [formData, setFormData] = useState<Partial<Omit<ItemInsert, 'code'>>>({
    name: '',
    category: 'injection',
    default_interval_weeks: 4,
    description: '',
    instructions: '',
    preparation_notes: '',
    requires_notification: true,
    notification_days_before: 7,
    is_active: true,
    sort_order: 0
  })

  // 항목 목록 조회
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: getAllItems
  })

  // 항목 추가
  const createMutation = useMutation({
    mutationFn: (data: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>) => 
      createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setIsAddDialogOpen(false)
      resetForm()
      toast({
        title: '항목 추가 완료',
        description: '새 항목이 성공적으로 추가되었습니다.',
      })
    },
    onError: (error) => {
      toast({
        title: '항목 추가 실패',
        description: '항목 추가 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
      console.error('Error creating item:', error)
    }
  })

  // 항목 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) => 
      updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setIsEditDialogOpen(false)
      setSelectedItem(null)
      resetForm()
      toast({
        title: '항목 수정 완료',
        description: '항목이 성공적으로 수정되었습니다.',
      })
    },
    onError: (error) => {
      toast({
        title: '항목 수정 실패',
        description: '항목 수정 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
      console.error('Error updating item:', error)
    }
  })

  // 항목 삭제
  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
      toast({
        title: '항목 삭제 완료',
        description: '항목이 성공적으로 삭제되었습니다.',
      })
    },
    onError: (error) => {
      toast({
        title: '항목 삭제 실패',
        description: '항목 삭제 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
      console.error('Error deleting item:', error)
    }
  })

  // 항목 상태 토글
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      toggleItemStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast({
        title: '상태 변경 완료',
        description: '항목 상태가 성공적으로 변경되었습니다.',
      })
    },
    onError: (error) => {
      toast({
        title: '상태 변경 실패',
        description: '상태 변경 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
      console.error('Error toggling item status:', error)
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'injection',
      default_interval_weeks: 4,
      description: '',
      instructions: '',
      preparation_notes: '',
      requires_notification: true,
      notification_days_before: 7,
      is_active: true,
      sort_order: 0
    })
  }

  const handleEdit = (item: Item) => {
    setSelectedItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      default_interval_weeks: item.default_interval_weeks || 4,
      description: item.description || '',
      instructions: item.instructions || '',
      preparation_notes: item.preparation_notes || '',
      requires_notification: item.requires_notification ?? true,
      notification_days_before: item.notification_days_before || 7,
      is_active: item.is_active ?? true,
      sort_order: item.sort_order || 0
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = (item: Item) => {
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditDialogOpen && selectedItem) {
      updateMutation.mutate({
        id: selectedItem.id,
        data: formData
      })
    } else {
      createMutation.mutate(formData as Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'injection':
        return <Badge className="bg-blue-100 text-blue-700">주사</Badge>
      case 'test':
        return <Badge className="bg-green-100 text-green-700">검사</Badge>
      case 'treatment':
        return <Badge className="bg-yellow-100 text-yellow-700">처치</Badge>
      case 'medication':
        return <Badge className="bg-purple-100 text-purple-700">약물</Badge>
      case 'other':
        return <Badge className="bg-gray-100 text-gray-700">기타</Badge>
      default:
        return <Badge variant="secondary">{category}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="항목명, 코드, 설명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="injection">주사</SelectItem>
            <SelectItem value="test">검사</SelectItem>
            <SelectItem value="medication">약물</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          항목 추가
        </Button>
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>항목명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>기본 주기</TableHead>
              <TableHead>알림</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  로딩 중...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  항목이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(item.category)}</TableCell>
                  <TableCell>
                    {item.default_interval_weeks ? `${item.default_interval_weeks}주` : '-'}
                  </TableCell>
                  <TableCell>
                    {item.requires_notification ? (
                      <Badge variant="outline" className="text-green-600">
                        {item.notification_days_before}일 전
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-400">
                        없음
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_active ?? true}
                      onCheckedChange={(checked) => 
                        toggleStatusMutation.mutate({ id: item.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4 mr-2" />
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(item)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} 
              onOpenChange={(open) => {
                if (!open) {
                  setIsAddDialogOpen(false)
                  setIsEditDialogOpen(false)
                  setSelectedItem(null)
                  resetForm()
                }
              }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? '항목 수정' : '새 항목 추가'}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen 
                ? '항목 정보를 수정합니다.' 
                : '새로운 검사/주사 항목을 추가합니다.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">항목명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 인베가 서스티나"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">카테고리 *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="injection">주사</SelectItem>
                      <SelectItem value="test">검사</SelectItem>
                      <SelectItem value="medication">약물</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">기본 주기 (주)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={formData.default_interval_weeks || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      default_interval_weeks: parseInt(e.target.value) || null 
                    })}
                    placeholder="4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="항목에 대한 설명을 입력하세요"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">지시사항</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions || ''}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="시행 시 주의사항이나 지시사항"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preparation">준비사항</Label>
                <Textarea
                  id="preparation"
                  value={formData.preparation_notes || ''}
                  onChange={(e) => setFormData({ ...formData, preparation_notes: e.target.value })}
                  placeholder="사전 준비사항"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="notification"
                    checked={formData.requires_notification ?? true}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, requires_notification: checked })
                    }
                  />
                  <Label htmlFor="notification">알림 설정</Label>
                </div>
                {formData.requires_notification && (
                  <div className="space-y-2">
                    <Label htmlFor="notification_days">알림 일수 (일 전)</Label>
                    <Input
                      id="notification_days"
                      type="number"
                      value={formData.notification_days_before || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        notification_days_before: parseInt(e.target.value) || null 
                      })}
                      placeholder="7"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active ?? true}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="active">활성 상태</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">정렬 순서</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      sort_order: parseInt(e.target.value) || 0 
                    })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" 
                      onClick={() => {
                        setIsAddDialogOpen(false)
                        setIsEditDialogOpen(false)
                        setSelectedItem(null)
                        resetForm()
                      }}>
                취소
              </Button>
              <Button type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}>
                {isEditDialogOpen ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedItem?.name}" 항목을 삭제하시겠습니까? 
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false)
              setSelectedItem(null)
            }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedItem) {
                  deleteMutation.mutate(selectedItem.id)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}