'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { getScheduleCategoryIcon, getScheduleCategoryColor, getScheduleCategoryBgColor, getScheduleCategoryLabel, getScheduleCardBgColor } from '@/lib/utils/schedule-category';
import { PatientRegistrationModal } from "@/components/patients/patient-registration-modal";
import { useAuth } from "@/providers/auth-provider-simple";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useFilteredTodayChecklist, useFilteredUpcomingSchedules, useFilteredSchedules } from "@/hooks/useFilteredSchedules";
import { useScheduleCompletion } from "@/hooks/useScheduleCompletion";
import { ScheduleCompletionDialog } from "@/components/schedules/schedule-completion-dialog";
import { ScheduleActionButtons } from "@/components/schedules/schedule-action-buttons";
import { ScheduleEditModal } from "@/components/schedules/schedule-edit-modal";
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status";
import type { ScheduleWithDetails } from "@/types/schedule";
import { format, startOfDay, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { safeFormatDate, safeParse, getDaysDifference } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { responsiveGrid, responsiveText, touchTarget } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AppIcon } from "@/components/ui/app-icon";
import { scheduleService } from "@/services/scheduleService";

export default function DashboardContent() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isMobile = useIsMobile();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 완료 처리 훅 사용
  const {
    selectedSchedule,
    executionDate,
    executionNotes,
    isSubmitting,
    isDialogOpen,
    handleComplete,
    handleSubmit,
    setExecutionDate,
    setExecutionNotes,
    setDialogOpen
  } = useScheduleCompletion();

  // Use React Query hooks for data fetching
  const todayQuery = useFilteredTodayChecklist();
  const upcomingQuery = useFilteredUpcomingSchedules(7);

  // Ensure data is always an array
  const todaySchedules = Array.isArray(todayQuery.data) ? todayQuery.data : [];
  const upcomingSchedules = Array.isArray(upcomingQuery.data) ? upcomingQuery.data : [];
  const todayLoading = todayQuery.isLoading;
  const upcomingLoading = upcomingQuery.isLoading;
  const refetchToday = todayQuery.refetch;
  const refetchUpcoming = upcomingQuery.refetch;

  // Get all schedules for additional calculations
  const { schedules: allSchedules = [], isLoading: allLoading, refetch: refetchAll } = useFilteredSchedules();

  const loading = todayLoading || upcomingLoading || allLoading;

  // Refresh data function
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
  };

  // Pause schedule handler
  const handlePause = async (schedule: ScheduleWithDetails) => {
    if (!profile?.organization_id) return;
    try {
      await scheduleService.pauseSchedule(schedule.schedule_id, profile.organization_id, { reason: '수동 보류' });
      toast({
        title: "보류 완료",
        description: `${schedule.patient_name}님의 ${schedule.item_name} 스케줄이 보류되었습니다.`,
      });
      refreshData();
    } catch (error) {
      console.error('Failed to pause schedule:', error);
      toast({
        title: "보류 실패",
        description: "스케줄을 보류하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Resume schedule handler
  const handleResume = async (schedule: ScheduleWithDetails) => {
    if (!profile?.organization_id) return;
    try {
      await scheduleService.resumeSchedule(schedule.schedule_id, profile.organization_id, {
        strategy: 'next_cycle',
        handleMissed: 'skip'
      });
      toast({
        title: "재개 완료",
        description: `${schedule.patient_name}님의 ${schedule.item_name} 스케줄이 재개되었습니다.`,
      });
      refreshData();
    } catch (error) {
      console.error('Failed to resume schedule:', error);
      toast({
        title: "재개 실패",
        description: "스케줄을 재개하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Delete schedule handler - shows confirmation dialog
  const handleDelete = (schedule: ScheduleWithDetails) => {
    setScheduleToDelete(schedule);
    setDeleteConfirmOpen(true);
  };

  // Actual deletion after confirmation
  const confirmDelete = async () => {
    if (!scheduleToDelete || !profile?.organization_id) return;

    setIsDeleting(true);
    try {
      await scheduleService.delete(scheduleToDelete.schedule_id, profile.organization_id);
      toast({
        title: "삭제 완료",
        description: `${scheduleToDelete.patient_name}님의 ${scheduleToDelete.item_name} 스케줄이 삭제되었습니다.`,
      });
      setDeleteConfirmOpen(false);
      setScheduleToDelete(null);
      refreshData();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast({
        title: "삭제 실패",
        description: "스케줄을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setScheduleToDelete(null);
    setIsDeleting(false);
  };

  // Edit modal state and handler
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithDetails | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate specific queries instead of all queries to prevent infinite loops
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
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

  // Profile is already fetched by useProfile hook - no need for duplicate fetch

  const handleRegistrationSuccess = () => {
    toast({
      title: "환자 등록 완료",
      description: "환자가 성공적으로 등록되었습니다. 환자 관리 페이지로 이동합니다.",
    });
    
    setTimeout(() => {
      router.push('/dashboard/patients');
    }, 1500);
  };


  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">프로필 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // 통계 계산
  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');

  // 1. 오늘 체크리스트
  const todayCount = todaySchedules.length;

  // 2. 미완료 누적 (오늘 이전의 미완료 항목)
  const overdueCount = allSchedules.filter(schedule => {
    if (schedule.status !== 'active') return false;
    const dueDate = safeParse(schedule.next_due_date);
    if (!dueDate) return false;
    return format(dueDate, 'yyyy-MM-dd') < todayStr;
  }).length;


  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'}`}>
        <div className="flex items-start gap-3">
          <AppIcon size={isMobile ? "md" : "lg"} className="mt-1" />
          <div>
            <h1 className={`${responsiveText.h2} font-bold text-gray-900`}>
              안녕하세요, {profile.name}님
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              오늘의 스케줄을 확인해보세요.
              <span className={`${isMobile ? 'block mt-1' : 'ml-2'} text-xs text-gray-400`}>
                마지막 업데이트: {format(lastUpdated, 'HH:mm:ss')}
              </span>
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 ${isMobile ? 'flex-1' : ''} ${touchTarget.button}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <div className={isMobile ? 'flex-1' : ''}>
            <PatientRegistrationModal onSuccess={handleRegistrationSuccess} />
          </div>
        </div>
      </div>

      {/* Stats Cards - 모바일: 2x2 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'p-3 pb-2' : 'pb-2'}`}>
            <CardTitle className="text-xs sm:text-sm font-medium">대기 중 스케줄</CardTitle>
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className="text-xl sm:text-2xl font-bold">{todayLoading ? '—' : todayCount}</div>
            <p className="text-xs text-muted-foreground">
              즉시 처리 필요
            </p>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? 'border-red-500' : ''}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'p-3 pb-2' : 'pb-2'}`}>
            <CardTitle className="text-xs sm:text-sm font-medium">미완료 누적</CardTitle>
            <AlertTriangle className={`h-3 w-3 sm:h-4 sm:w-4 ${overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className={`text-xl sm:text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>
              {allLoading ? '—' : overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              긴급 처리 필요
            </p>
          </CardContent>
        </Card>

      </div>

      {/* 오늘 체크리스트 (연체 포함) */}
      {todayCount > 0 && (
        <Card>
          <CardHeader className={isMobile ? 'p-4' : ''}>
            <CardTitle className={responsiveText.h3}>처리 대기 중인 스케줄</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              오늘까지 처리가 필요한 모든 검사/주사 일정입니다. (연체된 항목 포함)
            </CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
            <div className="space-y-3 sm:space-y-4">
              {todaySchedules.map((schedule, index) => {
                const dueDate = safeParse(schedule.next_due_date);
                // Use date boundaries for accurate day calculation
                const rawDaysOverdue = dueDate ? getDaysDifference(startOfDay(new Date()), startOfDay(dueDate)) : null;
                // Clamp to prevent negative values (future dates shouldn't appear as overdue)
                const daysOverdue = rawDaysOverdue !== null ? Math.max(0, rawDaysOverdue) : null;

                return (
                  <div
                    key={schedule.schedule_id || `today-${index}`}
                    className={`
                      ${isMobile ? 'flex-col space-y-3' : 'flex items-center justify-between'}
                      p-3 sm:p-4 border rounded-lg bg-red-50 border-red-200
                    `}
                  >
                    <div className={isMobile ? 'space-y-2' : ''}>
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm sm:text-base">
                          {schedule.patient_name || '환자 정보 없음'}
                        </h4>
                        {isMobile && daysOverdue !== null && (
                          <span className={`px-2 py-1 text-xs rounded shrink-0 ml-2 ${
                            daysOverdue === 0
                              ? 'bg-orange-100 text-orange-700'
                              : daysOverdue > 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {daysOverdue === 0 ? '오늘' : daysOverdue > 0 ? `${daysOverdue}일 연체` : '예정'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        {(() => {
                          const IconComponent = getScheduleCategoryIcon(schedule.item_category);
                          return IconComponent ? (
                            <IconComponent className={`h-4 w-4 ${getScheduleCategoryColor(schedule.item_category)}`} />
                          ) : null;
                        })()}
                        <span>{schedule.item_name || '항목 정보 없음'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getScheduleCategoryBgColor(schedule.item_category)} ${getScheduleCategoryColor(schedule.item_category)}`}>
                          {getScheduleCategoryLabel(schedule.item_category)}
                        </span>
                        {/* 주사 용량 표시 */}
                        {schedule.item_category === 'injection' && schedule.injection_dosage && (
                          <span className="text-xs text-blue-600 font-medium">
                            용량: {schedule.injection_dosage}mg
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-red-600">
                        예정일: {safeFormatDate(schedule.next_due_date, 'yyyy년 MM월 dd일')}
                        {schedule.interval_weeks && (
                          <span className={isMobile ? 'block' : 'inline'}>
                            {isMobile ? '' : ' • '}{schedule.interval_weeks}주 주기
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span>
                          주치의: {schedule.doctor_name || (schedule.doctor_id ? '지정됨' : '미지정')}
                        </span>
                        <span>
                          소속: {schedule.care_type || schedule.patient_care_type || '미지정'}
                        </span>
                      </div>
                      {schedule.notes && (
                        <p className="text-xs text-gray-500">{schedule.notes}</p>
                      )}
                    </div>
                    <div className={`flex items-center ${isMobile ? 'w-full' : 'gap-2'}`}>
                      <ScheduleActionButtons
                        schedule={schedule}
                        variant='default'
                        showStatus={false}
                        showButtonLabels={true}  // 명시적으로 라벨 표시
                        onComplete={() => handleComplete(schedule)}
                        onPause={() => handlePause(schedule)}
                        onResume={() => handleResume(schedule)}
                        onEdit={() => setEditingSchedule(schedule)}
                        onDelete={() => handleDelete(schedule)}
                      />
                      {!isMobile && daysOverdue !== null && (
                        <Badge className={
                          daysOverdue === 0
                            ? "bg-orange-100 text-orange-700"
                            : daysOverdue > 0
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }>
                          {daysOverdue === 0 ? '오늘' : daysOverdue > 0 ? `${daysOverdue}일 연체` : '예정'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 예정된 스케줄 (실행 가능 기간) */}
      <Card>
        <CardHeader className={isMobile ? 'p-4' : ''}>
          <CardTitle className={responsiveText.h3}>실행 가능한 스케줄</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            예정일 1주일 전부터 1주일 후까지 실행 가능한 검사/주사 일정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              스케줄을 불러오는 중...
            </div>
          ) : upcomingSchedules.length === 0 ? (
            <div className="text-center py-12">
              <AppIcon size="xl" className="mx-auto mb-4 opacity-50" />
              <p className="text-gray-500">실행 가능한 스케줄이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {upcomingSchedules.map((schedule, index) => {
                const dueDate = safeParse(schedule.next_due_date);
                // Use date boundaries for accurate day calculation
                const daysUntil = dueDate ? getDaysDifference(startOfDay(dueDate), startOfDay(new Date())) : null;

                return (
                  <div
                    key={schedule.schedule_id || `upcoming-${index}`}
                    className={`
                      ${isMobile ? 'flex-col space-y-3' : 'flex items-center justify-between'}
                      p-3 sm:p-4 border rounded-lg ${getScheduleCardBgColor(schedule.item_category)}
                    `}
                  >
                    <div className={isMobile ? 'space-y-2' : ''}>
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm sm:text-base">
                          {schedule.patient_name || '환자 정보 없음'}
                        </h4>
                        {isMobile && daysUntil !== null && (
                          <span className={`px-2 py-1 text-xs rounded shrink-0 ml-2 ${
                            schedule.status === 'paused'
                              ? 'bg-gray-100 text-gray-600'
                              : daysUntil < 0
                              ? 'bg-blue-100 text-blue-700'
                              : daysUntil === 0
                              ? 'bg-orange-100 text-orange-700'
                              : daysUntil <= 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {daysUntil < 0 ? `${Math.abs(daysUntil)}일 전` : daysUntil === 0 ? '오늘' : daysUntil === 1 ? '내일' : `${daysUntil}일 후`}
                            {schedule.status === 'paused' && ' (보류)'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        {(() => {
                          const IconComponent = getScheduleCategoryIcon(schedule.item_category);
                          return IconComponent ? (
                            <IconComponent className={`h-4 w-4 ${getScheduleCategoryColor(schedule.item_category)}`} />
                          ) : null;
                        })()}
                        <span>{schedule.item_name || '항목 정보 없음'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getScheduleCategoryBgColor(schedule.item_category)} ${getScheduleCategoryColor(schedule.item_category)}`}>
                          {getScheduleCategoryLabel(schedule.item_category)}
                        </span>
                        {/* 주사 용량 표시 */}
                        {schedule.item_category === 'injection' && schedule.injection_dosage && (
                          <span className="text-xs text-blue-600 font-medium">
                            용량: {schedule.injection_dosage}mg
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        예정일: {safeFormatDate(schedule.next_due_date, 'yyyy년 MM월 dd일')}
                        {schedule.interval_weeks && (
                          <span className={isMobile ? 'block' : 'inline'}>
                            {isMobile ? '' : ' • '}{schedule.interval_weeks}주 주기
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span>
                          주치의: {schedule.doctor_name || (schedule.doctor_id ? '지정됨' : '미지정')}
                        </span>
                        <span>
                          소속: {schedule.care_type || schedule.patient_care_type || '미지정'}
                        </span>
                      </div>
                      {schedule.notes && (
                        <p className="text-xs text-gray-500">{schedule.notes}</p>
                      )}
                    </div>
                    <div className={`flex items-center ${isMobile ? 'w-full' : 'gap-2'}`}>
                      <ScheduleActionButtons
                        schedule={schedule}
                        variant='default'
                        showStatus={false}
                        showButtonLabels={true}
                        onComplete={() => handleComplete(schedule)}
                        onPause={() => handlePause(schedule)}
                        onResume={() => handleResume(schedule)}
                        onEdit={() => setEditingSchedule(schedule)}
                        onDelete={() => handleDelete(schedule)}
                      />
                      {!isMobile && (
                        schedule.status === 'paused' ? (
                          <Badge className="bg-gray-100 text-gray-600">
                            {daysUntil !== null ? (
                              `${daysUntil < 0 ? `${Math.abs(daysUntil)}일 전` : daysUntil === 0 ? '오늘' : daysUntil === 1 ? '내일' : `${daysUntil}일 후`} (보류)`
                            ) : '보류'}
                          </Badge>
                        ) : (
                          <Badge className={getStatusBadgeClass(getScheduleStatusLabel(schedule).variant)}>
                            {getScheduleStatusLabel(schedule).label}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 완료 처리 다이얼로그 */}
      <ScheduleCompletionDialog
        schedule={selectedSchedule}
        isOpen={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        executionDate={executionDate}
        executionNotes={executionNotes}
        isSubmitting={isSubmitting}
        onExecutionDateChange={setExecutionDate}
        onExecutionNotesChange={setExecutionNotes}
        onSubmit={handleSubmit}
      />

      {/* 수정 모달 */}
      {editingSchedule && (
        <ScheduleEditModal
          schedule={editingSchedule}
          open={Boolean(editingSchedule)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSchedule(null);
            }
          }}
          onSuccess={() => {
            setEditingSchedule(null);
            refreshData();
          }}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>스케줄 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {scheduleToDelete ? (
                <span>
                  <strong>{scheduleToDelete.patient_name}</strong>님의{' '}
                  <strong>{scheduleToDelete.item_name}</strong> 스케줄을 삭제하시겠습니까?
                  <br />
                  <br />
                  이 작업은 되돌릴 수 없습니다.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}