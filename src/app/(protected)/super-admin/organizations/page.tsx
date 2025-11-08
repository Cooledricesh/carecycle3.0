'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSuperAdminOrganizations } from '@/hooks/useSuperAdminOrganizations';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
}

type OrganizationAction = {
  organization: Organization;
  action: 'edit' | 'deactivate' | 'activate';
};

export default function OrganizationsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<OrganizationAction | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [editOrgName, setEditOrgName] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { toast } = useToast();

  const {
    data,
    isLoading: loading,
    createOrganization,
    updateOrganization,
    isCreating,
    isUpdating,
  } = useSuperAdminOrganizations({
    isActive: filter === 'all' ? null : filter === 'active',
  });

  const organizations = data?.organizations || [];
  const processing = isCreating || isUpdating;

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast({
        title: '오류',
        description: '조직 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    if (newOrgName.length > 100) {
      toast({
        title: '오류',
        description: '조직 이름은 100자 이내로 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createOrganization({ name: newOrgName.trim() });

      toast({
        title: '성공',
        description: `${newOrgName} 조직이 생성되었습니다.`,
      });

      setNewOrgName('');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '조직 생성에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleEditOrganization = async () => {
    if (!selectedOrg || !editOrgName.trim()) {
      toast({
        title: '오류',
        description: '조직 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    if (editOrgName.length > 100) {
      toast({
        title: '오류',
        description: '조직 이름은 100자 이내로 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateOrganization({ id: selectedOrg.id, name: editOrgName.trim() });

      toast({
        title: '성공',
        description: `조직 정보가 수정되었습니다.`,
      });

      setEditDialogOpen(false);
      setSelectedOrg(null);
      setEditOrgName('');
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '조직 수정에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async () => {
    if (!actionDialog) return;

    const { organization, action } = actionDialog;

    try {
      const isActivate = action === 'activate';
      await updateOrganization({ id: organization.id, is_active: isActivate });

      toast({
        title: '성공',
        description: `${organization.name} 조직이 ${isActivate ? '활성화' : '비활성화'}되었습니다.`,
      });

      setActionDialog(null);
    } catch (error) {
      console.error('Error toggling organization:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '조직 상태 변경에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (org: Organization) => {
    setSelectedOrg(org);
    setEditOrgName(org.name);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">조직 목록 로딩 중...</p>
      </div>
    );
  }

  const activeCount = organizations.filter(o => o.is_active).length;
  const inactiveCount = organizations.filter(o => !o.is_active).length;
  const filteredOrgs = organizations.filter(org => {
    if (filter === 'active') return org.is_active;
    if (filter === 'inactive') return !org.is_active;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">조직 관리</h1>
          <p className="text-gray-600">시스템에 등록된 조직을 관리합니다.</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          조직 생성
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 조직</CardDescription>
            <CardTitle className="text-2xl">{organizations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>활성 조직</CardDescription>
            <CardTitle className="text-2xl text-green-600">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>비활성 조직</CardDescription>
            <CardTitle className="text-2xl text-gray-600">{inactiveCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'active'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          활성
        </button>
        <button
          onClick={() => setFilter('inactive')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'inactive'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          비활성
        </button>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>조직 목록</CardTitle>
          <CardDescription>등록된 모든 조직을 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>조직명</TableHead>
                <TableHead>사용자 수</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    조직이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell>{org.user_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant={org.is_active ? 'default' : 'secondary'}
                        className={org.is_active ? 'bg-green-100 text-green-800' : ''}
                      >
                        {org.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(org.created_at), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(org)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setActionDialog({
                              organization: org,
                              action: org.is_active ? 'deactivate' : 'activate',
                            })
                          }
                        >
                          {org.is_active ? '비활성화' : '활성화'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 조직 생성</DialogTitle>
            <DialogDescription>
              새로운 조직을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">조직명</Label>
              <Input
                id="org-name"
                placeholder="조직 이름을 입력하세요"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                maxLength={100}
                disabled={processing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewOrgName('');
              }}
              disabled={processing}
            >
              취소
            </Button>
            <Button onClick={handleCreateOrganization} disabled={processing}>
              {processing ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>조직 정보 수정</DialogTitle>
            <DialogDescription>
              조직 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">조직명</Label>
              <Input
                id="edit-org-name"
                placeholder="조직 이름을 입력하세요"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                maxLength={100}
                disabled={processing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedOrg(null);
                setEditOrgName('');
              }}
              disabled={processing}
            >
              취소
            </Button>
            <Button onClick={handleEditOrganization} disabled={processing}>
              {processing ? '수정 중...' : '수정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate/Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!actionDialog}
        onOpenChange={() => setActionDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.action === 'activate' ? '조직 활성화' : '조직 비활성화'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.organization.name}을(를){' '}
              {actionDialog?.action === 'activate' ? '활성화' : '비활성화'}하시겠습니까?
              {actionDialog?.action === 'deactivate' &&
                ' 비활성화된 조직의 사용자는 시스템에 접근할 수 없습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={processing}>
              {processing ? '처리 중...' : '확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
