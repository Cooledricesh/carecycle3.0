'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, AlertCircle, Check, RefreshCw } from "lucide-react";
import { PatientRegistrationModal } from "@/components/patients/patient-registration-modal";
import { useAuth } from "@/providers/auth-provider-simple";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTodayChecklist, useUpcomingSchedules } from "@/hooks/useSchedules";
import { scheduleService } from "@/services/scheduleService";
import type { ScheduleWithDetails } from "@/types/schedule";
import { format, isToday, isWithinInterval, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithDetails | null>(null);
  const [executionDate, setExecutionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [executionNotes, setExecutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use React Query hooks for data fetching
  const { data: todaySchedules = [], isLoading: todayLoading, refetch: refetchToday } = useTodayChecklist();
  const { data: upcomingSchedules = [], isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingSchedules(7);
  
  const loading = todayLoading || upcomingLoading;

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all queries to get fresh data
      await queryClient.invalidateQueries();
      setLastUpdated(new Date());
      toast({
        title: "새로고침 완료",
        description: "최신 데이터를 불러왔습니다.",
      });
    } catch (error) {
      toast({
        title: "새로고침 실패",
        description: "데이터를 새로고침하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      setProfile({ name: user.email?.split('@')[0] || 'User' });
    }
  }, [user]);

  const handleRegistrationSuccess = () => {
    toast({
      title: "환자 등록 완료",
      description: "환자가 성공적으로 등록되었습니다. 환자 관리 페이지로 이동합니다.",
    });
    
    setTimeout(() => {
      router.push('/dashboard/patients');
    }, 1500);
  };

  const handleCompleteClick = (schedule: ScheduleWithDetails) => {
    setSelectedSchedule(schedule);
    setExecutionDate(format(new Date(), 'yyyy-MM-dd'));
    setExecutionNotes('');
    setIsCompletionDialogOpen(true);
  };

  const handleCompleteSubmit = async () => {
    if (!selectedSchedule || !user) return;

    setIsSubmitting(true);
    try {
      // 완료 처리 API 호출
      await scheduleService.markAsCompleted(selectedSchedule.id, {
        executedDate: executionDate,
        notes: executionNotes,
        executedBy: user.id
      });

      toast({
        title: "완료 처리 성공",
        description: `${selectedSchedule.patient?.name}님의 ${selectedSchedule.item?.name} 일정이 완료 처리되었습니다.`,
      });

      // Reset state and close dialog
      setSelectedSchedule(null);
      setExecutionNotes('');
      setIsCompletionDialogOpen(false);
      
      // Invalidate all queries for immediate update
      await queryClient.invalidateQueries();
      setLastUpdated(new Date());
      
      // Force refetch current data
      await Promise.all([
        refetchToday(),
        refetchUpcoming()
      ]);
    } catch (error) {
      console.error('Failed to mark schedule as completed:', error);
      toast({
        title: "오류",
        description: "완료 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      
      // Refetch to ensure data consistency after error
      await Promise.all([
        refetchToday(),
        refetchUpcoming()
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return null;
  }

  // 통계 계산
  const overdueCount = todaySchedules.length;
  const weekCount = upcomingSchedules.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요, {profile.name}님
          </h1>
          <p className="text-gray-600">
            오늘의 스케줄을 확인해보세요.
            <span className="text-xs text-gray-400 ml-2">
              마지막 업데이트: {format(lastUpdated, 'HH:mm:ss')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <PatientRegistrationModal onSuccess={handleRegistrationSuccess} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 체크리스트</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              오늘까지 처리할 일정
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1주일 이내</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekCount}</div>
            <p className="text-xs text-muted-foreground">
              예정된 일정
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 스케줄</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount + weekCount}</div>
            <p className="text-xs text-muted-foreground">
              전체 진행 중
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">알림 필요</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              즉시 확인 필요
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 오늘 체크리스트 */}
      {todaySchedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>오늘 체크리스트</CardTitle>
            <CardDescription>
              오늘까지 처리해야 할 검사/주사 일정입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todaySchedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50 border-red-200">
                  <div>
                    <h4 className="font-medium">{schedule.patient?.name || '환자 정보 없음'}</h4>
                    <p className="text-sm text-gray-600">
                      {schedule.item?.name || '항목 정보 없음'} • {schedule.item?.category}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      예정일: {format(new Date(schedule.nextDueDate), 'yyyy년 MM월 dd일', { locale: ko })}
                      {schedule.intervalDays && ` • ${Math.round(schedule.intervalDays / 7)}주 주기`}
                    </p>
                    {schedule.notes && (
                      <p className="text-xs text-gray-500 mt-1">{schedule.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleCompleteClick(schedule)}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      완료 처리
                    </Button>
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                      오늘 처리 필요
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 예정된 스케줄 (실행 가능 기간) */}
      <Card>
        <CardHeader>
          <CardTitle>실행 가능한 스케줄</CardTitle>
          <CardDescription>
            예정일 1주일 전부터 1주일 후까지 실행 가능한 검사/주사 일정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              스케줄을 불러오는 중...
            </div>
          ) : upcomingSchedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              실행 가능한 스케줄이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSchedules.map((schedule) => {
                const dueDate = new Date(schedule.nextDueDate);
                const today = new Date();
                const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{schedule.patient?.name || '환자 정보 없음'}</h4>
                      <p className="text-sm text-gray-600">
                        {schedule.item?.name || '항목 정보 없음'} • {schedule.item?.category}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        예정일: {format(dueDate, 'yyyy년 MM월 dd일', { locale: ko })}
                        {schedule.intervalDays && ` • ${Math.round(schedule.intervalDays / 7)}주 주기`}
                      </p>
                      {schedule.notes && (
                        <p className="text-xs text-gray-500 mt-1">{schedule.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteClick(schedule)}
                        className="flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" />
                        완료 처리
                      </Button>
                      <span className={`px-2 py-1 text-xs rounded ${
                        daysUntil < 0
                          ? 'bg-blue-100 text-blue-700'
                          : daysUntil === 0 
                          ? 'bg-orange-100 text-orange-700'
                          : daysUntil <= 3
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {daysUntil < 0 ? `${Math.abs(daysUntil)}일 전` : daysUntil === 0 ? '오늘' : daysUntil === 1 ? '내일' : `${daysUntil}일 후`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 완료 처리 다이얼로그 */}
      <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>일정 완료 처리</DialogTitle>
            <DialogDescription>
              {selectedSchedule && (
                <>
                  <strong>{selectedSchedule.patient?.name}</strong>님의{' '}
                  <strong>{selectedSchedule.item?.name}</strong> 일정을 완료 처리합니다.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="execution-date" className="text-right">
                시행일
              </Label>
              <Input
                id="execution-date"
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="execution-notes" className="text-right">
                메모
              </Label>
              <Textarea
                id="execution-notes"
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                placeholder="시행 관련 메모를 입력하세요 (선택사항)"
                className="col-span-3"
                rows={3}
              />
            </div>
            {selectedSchedule && (
              <div className="text-sm text-gray-600">
                <p>다음 예정일: {
                  format(
                    addDays(new Date(executionDate), selectedSchedule.intervalDays),
                    'yyyy년 MM월 dd일',
                    { locale: ko }
                  )
                } (자동 계산됨)</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCompletionDialogOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleCompleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '처리 중...' : '완료 처리'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}