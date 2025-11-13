'use client';

/**
 * Invite User Modal Component
 *
 * Modal dialog for inviting new users to the organization
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inviteSchema = z.object({
  email: z.string().email('이메일 주소가 올바르지 않습니다'),
  role: z.enum(['admin', 'doctor', 'nurse'], {
    errorMap: () => ({ message: '역할을 선택해주세요' }),
  }),
  care_type: z.string({
    errorMap: () => ({ message: '케어 타입을 선택해주세요' }),
  }).optional(),
}).refine((data) => {
  // nurse 역할인 경우 care_type 필수
  if (data.role === 'nurse') {
    return data.care_type !== undefined && data.care_type !== '';
  }
  return true;
}, {
  message: '케어 타입을 선택해주세요',
  path: ['care_type'],
});

type InviteFormData = {
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | '';
  care_type?: string;
};

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();

  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: '',
    care_type: undefined,
  });

  const [errors, setErrors] = useState<{
    email?: string;
    role?: string;
    care_type?: string;
  }>({});

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; care_type?: string }) => {
      console.log('[InviteUserModal] Mutation started with data:', data);
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('[InviteUserModal] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[InviteUserModal] API error:', error);
        throw new Error(error.error || 'Failed to create invitation');
      }

      const result = await response.json();
      console.log('[InviteUserModal] Success response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[InviteUserModal] onSuccess triggered with data:', data);
      toast({
        title: '초대장 전송 완료',
        description: '사용자 초대가 성공적으로 완료되었습니다.',
      });

      // Reset form
      setFormData({ email: '', role: '', care_type: undefined });
      setErrors({});

      // Refetch invitations list
      queryClient.invalidateQueries({ queryKey: ['invitations'] });

      // Close modal
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('[InviteUserModal] onError triggered:', error);
      toast({
        title: '초대 전송 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[InviteUserModal] Submit clicked, formData:', formData);

    // Validate
    const validation = inviteSchema.safeParse(formData);

    if (!validation.success) {
      console.log('[InviteUserModal] Validation failed:', validation.error.errors);
      const fieldErrors: { email?: string; role?: string; care_type?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    console.log('[InviteUserModal] Validation passed');

    // Clear errors
    setErrors({});

    // Submit
    const mutationData: { email: string; role: string; care_type?: string } = {
      email: formData.email,
      role: formData.role as string,
    };

    // Add care_type for nurse role
    if (formData.role === 'nurse' && formData.care_type) {
      mutationData.care_type = formData.care_type;
    }

    console.log('[InviteUserModal] Sending mutation with data:', mutationData);
    createInvitationMutation.mutate(mutationData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>사용자 초대</DialogTitle>
          <DialogDescription>
            새로운 사용자에게 초대 링크를 전송합니다. 초대받은 사용자는 링크를 통해 계정을 생성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일 주소</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email ? <p className="text-sm text-red-500">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">역할</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as 'admin' | 'doctor' | 'nurse', care_type: undefined })
              }
            >
              <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                <SelectValue placeholder="역할을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="doctor">주치의</SelectItem>
                <SelectItem value="nurse">스텝</SelectItem>
              </SelectContent>
            </Select>
            {errors.role ? <p className="text-sm text-red-500">{errors.role}</p> : null}
          </div>

          {formData.role === 'nurse' && (
            <div className="space-y-2">
              <Label htmlFor="care_type">케어 타입</Label>
              <Select
                value={formData.care_type || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, care_type: value })
                }
                disabled={departmentsLoading}
              >
                <SelectTrigger className={errors.care_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder={departmentsLoading ? '로딩 중...' : '케어 타입을 선택하세요'} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.care_type ? <p className="text-sm text-red-500">{errors.care_type}</p> : null}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createInvitationMutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={createInvitationMutation.isPending}>
              {createInvitationMutation.isPending ? '전송 중...' : '초대 전송'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
