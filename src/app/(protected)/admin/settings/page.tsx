'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, AlertCircle, Save } from 'lucide-react';
import { z } from 'zod';

interface OrganizationPolicy {
  id: string;
  organization_id: string;
  auto_hold_overdue_days: number | null;
  created_at: string;
  updated_at: string;
}

const policySchema = z.object({
  auto_hold_overdue_days: z.number().int().min(0).nullable(),
});

type PolicyFormData = z.infer<typeof policySchema>;

export default function SettingsPage() {
  const [autoHoldDays, setAutoHoldDays] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization policy
  const { data: policyData, isLoading } = useQuery({
    queryKey: ['admin', 'organization-policies'],
    queryFn: async (): Promise<OrganizationPolicy | null> => {
      const response = await fetch('/api/admin/organization-policies');
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch policy');
      }
      const data = await response.json();
      return data.policy || null;
    },
    staleTime: 1000 * 60 * 5, // 5분
  });

  // Initialize form when data is loaded
  useEffect(() => {
    if (policyData?.auto_hold_overdue_days !== undefined) {
      setAutoHoldDays(policyData.auto_hold_overdue_days?.toString() || '');
    }
  }, [policyData]);

  // Update policy mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      const method = policyData ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/organization-policies', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update policy');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization-policies'] });
      toast({
        title: '성공',
        description: '정책이 저장되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    const parsedValue = autoHoldDays === '' ? null : parseInt(autoHoldDays);

    // Validation
    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) {
      toast({
        title: '오류',
        description: '0 이상의 숫자를 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const validatedData = policySchema.parse({
        auto_hold_overdue_days: parsedValue,
      });
      updateMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: '유효성 검사 오류',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse" role="status">
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
            <Settings className="w-6 h-6" />
            조직 정책 설정
          </h1>
          <p className="text-gray-600">조직의 정책을 관리하고 설정합니다.</p>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">정책 설정 정보</p>
          <p className="text-blue-700 mt-1">
            조직의 자동 보류 정책을 설정합니다. 설정된 일수를 초과한 스케줄은 자동으로 보류 상태로
            전환됩니다.
          </p>
        </div>
      </div>

      {/* Auto-Hold Policy Card */}
      <Card>
        <CardHeader>
          <CardTitle>자동 보류 정책</CardTitle>
          <CardDescription>
            예정일을 초과한 스케줄을 자동으로 보류 상태로 전환하는 기준을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto-hold-days">
                자동 보류 기준 일수
                <span className="text-gray-500 text-sm ml-2">(선택사항)</span>
              </Label>
              <div className="space-y-3">
                <div className="max-w-xs">
                  <Input
                    id="auto-hold-days"
                    type="number"
                    min="0"
                    value={autoHoldDays}
                    onChange={(e) => setAutoHoldDays(e.target.value)}
                    placeholder="예: 30"
                    aria-label="자동 보류 기준 일수"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  예정일을 기준으로 며칠이 지나면 일정을 보류 항목으로 옮길지 설정합니다.
                  <br />
                  비워두면 자동 보류 기능이 비활성화됩니다.
                </p>
              </div>
            </div>

            {/* Current Policy Display */}
            {policyData && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">현재 설정</p>
                <p className="text-sm text-gray-600">
                  {policyData.auto_hold_overdue_days !== null
                    ? `예정일로부터 ${policyData.auto_hold_overdue_days}일 경과 시 자동 보류`
                    : '자동 보류 기능 비활성화'}
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Additional Policies Card (placeholder for future) */}
      <Card>
        <CardHeader>
          <CardTitle>추가 정책</CardTitle>
          <CardDescription>향후 추가될 정책 설정이 여기에 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">현재 추가 정책이 없습니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
