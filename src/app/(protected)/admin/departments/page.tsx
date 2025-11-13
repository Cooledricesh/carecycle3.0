'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Department {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface DepartmentFormData {
  name: string;
  description: string;
  display_order: number;
}

export default function DepartmentsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    description: '',
    display_order: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: async (): Promise<Department[]> => {
      const response = await fetch('/api/admin/departments');
      if (!response.ok) {
        throw new Error('Failed to fetch departments');
      }
      const data = await response.json();
      return data.departments || [];
    },
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || error?.error || error?.message || 'Failed to create department');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: '성공',
        description: '부서가 생성되었습니다.',
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DepartmentFormData> }) => {
      const response = await fetch(`/api/admin/departments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || error?.error || error?.message || 'Failed to update department');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: '성공',
        description: '부서 정보가 수정되었습니다.',
      });
      setIsEditDialogOpen(false);
      setSelectedDepartment(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/departments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || error?.error || error?.message || 'Failed to delete department');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: '성공',
        description: '부서가 삭제되었습니다.',
      });
      setIsDeleteDialogOpen(false);
      setSelectedDepartment(null);
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      display_order: 0,
    });
  };

  const handleCreateClick = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEditClick = (department: Department) => {
    setSelectedDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      display_order: department.display_order,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (department: Department) => {
    setSelectedDepartment(department);
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: '오류',
        description: '부서명을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedDepartment) return;
    if (!formData.name.trim()) {
      toast({
        title: '오류',
        description: '부서명을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate({
      id: selectedDepartment.id,
      data: formData,
    });
  };

  const handleDelete = () => {
    if (!selectedDepartment) return;
    deleteMutation.mutate(selectedDepartment.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            부서 관리
          </h1>
          <p className="text-gray-600">조직의 부서를 관리하고 설정합니다.</p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          부서 추가
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>전체 부서</CardDescription>
          <CardTitle className="text-2xl">{departments.length}</CardTitle>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">부서 관리 정보</p>
          <p className="text-blue-700 mt-1">
            부서는 스텝(간호사) 사용자에게 필수 항목입니다. 주치의와 관리자는 부서를 지정하지 않습니다.
          </p>
        </div>
      </div>

      {/* Departments Table */}
      <Card>
        <CardHeader>
          <CardTitle>부서 목록</CardTitle>
          <CardDescription>등록된 모든 부서를 확인하고 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">등록된 부서가 없습니다.</p>
              <Button onClick={handleCreateClick} className="mt-4">
                첫 부서 추가하기
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서명</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>표시 순서</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {department.description || '-'}
                    </TableCell>
                    <TableCell>{department.display_order}</TableCell>
                    <TableCell>
                      <Badge
                        variant={department.is_active ? 'default' : 'secondary'}
                        className={department.is_active ? 'bg-green-100 text-green-800' : ''}
                      >
                        {department.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(department.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditClick(department)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClick(department)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>부서 추가</DialogTitle>
            <DialogDescription>새로운 부서를 추가합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">부서명 *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 내과, 외과, 소아과"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">설명</Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="부서에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-order">표시 순서</Label>
              <Input
                id="create-order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              취소
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>부서 수정</DialogTitle>
            <DialogDescription>부서 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">부서명 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 내과, 외과, 소아과"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">설명</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="부서에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-order">표시 순서</Label>
              <Input
                id="edit-order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              취소
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '수정 중...' : '수정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>부서 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{selectedDepartment?.name}&rdquo; 부서를 삭제하시겠습니까?
              <br />
              <br />
              <span className="text-red-600 font-medium">
                주의: 이 부서를 사용하는 사용자가 있을 경우 삭제가 실패할 수 있습니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
