'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, AlertCircle, Check, RefreshCw } from "lucide-react";
import { PatientRegistrationModal } from "@/components/patients/patient-registration-modal";
import { useAuth } from "@/providers/auth-provider-simple";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTodayChecklist, useUpcomingSchedules } from "@/hooks/useSchedules";
import { useScheduleCompletion } from "@/hooks/useScheduleCompletion";
import { ScheduleCompletionDialog } from "@/components/schedules/schedule-completion-dialog";
import { ScheduleActionButtons } from "@/components/schedules/schedule-action-buttons";
import { getScheduleStatusLabel, getStatusBadgeClass } from "@/lib/utils/schedule-status";
import type { ScheduleWithDetails } from "@/types/schedule";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { safeFormatDate, safeParse, getDaysDifference } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { responsiveGrid, responsiveText, touchTarget } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
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


  if (!profile) {
    return null;
  }

  // 통계 계산
  const overdueCount = todaySchedules.length;
  const weekCount = upcomingSchedules.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'}`}>
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
            <CardTitle className="text-xs sm:text-sm font-medium">오늘 체크리스트</CardTitle>
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className="text-xl sm:text-2xl font-bold">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              오늘까지 처리할 일정
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'p-3 pb-2' : 'pb-2'}`}>
            <CardTitle className="text-xs sm:text-sm font-medium">1주일 이내</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className="text-xl sm:text-2xl font-bold">{weekCount}</div>
            <p className="text-xs text-muted-foreground">
              예정된 일정
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'p-3 pb-2' : 'pb-2'}`}>
            <CardTitle className="text-xs sm:text-sm font-medium">활성 스케줄</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className="text-xl sm:text-2xl font-bold">{overdueCount + weekCount}</div>
            <p className="text-xs text-muted-foreground">
              전체 진행 중
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'p-3 pb-2' : 'pb-2'}`}>
            <CardTitle className="text-xs sm:text-sm font-medium">알림 필요</CardTitle>
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={isMobile ? 'p-3 pt-0' : ''}>
            <div className="text-xl sm:text-2xl font-bold">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              즉시 확인 필요
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 오늘 체크리스트 */}
      {todaySchedules.length > 0 && (
        <Card>
          <CardHeader className={isMobile ? 'p-4' : ''}>
            <CardTitle className={responsiveText.h3}>오늘 체크리스트</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              오늘까지 처리해야 할 검사/주사 일정입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
            <div className="space-y-3 sm:space-y-4">
              {todaySchedules.map((schedule) => (
                <div 
                  key={schedule.id} 
                  className={`
                    ${isMobile ? 'flex-col space-y-3' : 'flex items-center justify-between'}
                    p-3 sm:p-4 border rounded-lg bg-red-50 border-red-200
                  `}
                >
                  <div className={isMobile ? 'space-y-2' : ''}>
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm sm:text-base">
                        {schedule.patient?.name || '환자 정보 없음'}
                      </h4>
                      {isMobile && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded shrink-0 ml-2">
                          오늘 처리
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {schedule.item?.name || '항목 정보 없음'} • {schedule.item?.category}
                    </p>
                    <p className="text-xs text-red-600">
                      예정일: {safeFormatDate(schedule.nextDueDate, 'yyyy년 MM월 dd일')}
                      {schedule.intervalWeeks && (
                        <span className={isMobile ? 'block' : 'inline'}>
                          {isMobile ? '' : ' • '}{schedule.intervalWeeks}주 주기
                        </span>
                      )}
                    </p>
                    {schedule.notes && (
                      <p className="text-xs text-gray-500">{schedule.notes}</p>
                    )}
                  </div>
                  <div className={`flex items-center ${isMobile ? 'w-full' : 'gap-2'}`}>
                    <ScheduleActionButtons
                      schedule={schedule}
                      variant={isMobile ? 'default' : 'compact'}
                      showStatus={false}
                      onComplete={() => handleComplete(schedule)}
                    />
                    {!isMobile && (
                      <Badge className="bg-red-100 text-red-700">
                        오늘 처리 필요
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
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
            <div className="text-center py-8 text-gray-500">
              실행 가능한 스케줄이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {upcomingSchedules.map((schedule) => {
                const dueDate = safeParse(schedule.nextDueDate);
                const daysUntil = dueDate ? getDaysDifference(dueDate, new Date()) : null;
                
                return (
                  <div 
                    key={schedule.id} 
                    className={`
                      ${isMobile ? 'flex-col space-y-3' : 'flex items-center justify-between'}
                      p-3 sm:p-4 border rounded-lg
                    `}
                  >
                    <div className={isMobile ? 'space-y-2' : ''}>
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm sm:text-base">
                          {schedule.patient?.name || '환자 정보 없음'}
                        </h4>
                        {isMobile && daysUntil !== null && (
                          <span className={`px-2 py-1 text-xs rounded shrink-0 ml-2 ${
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
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {schedule.item?.name || '항목 정보 없음'} • {schedule.item?.category}
                      </p>
                      <p className="text-xs text-gray-500">
                        예정일: {safeFormatDate(schedule.nextDueDate, 'yyyy년 MM월 dd일')}
                        {schedule.intervalWeeks && (
                          <span className={isMobile ? 'block' : 'inline'}>
                            {isMobile ? '' : ' • '}{schedule.intervalWeeks}주 주기
                          </span>
                        )}
                      </p>
                      {schedule.notes && (
                        <p className="text-xs text-gray-500">{schedule.notes}</p>
                      )}
                    </div>
                    <div className={`flex items-center ${isMobile ? 'w-full' : 'gap-2'}`}>
                      <ScheduleActionButtons
                        schedule={schedule}
                        variant={isMobile ? 'default' : 'compact'}
                        showStatus={false}
                        onComplete={() => handleComplete(schedule)}
                      />
                      {!isMobile && (() => {
                        const statusInfo = getScheduleStatusLabel(schedule);
                        return (
                          <Badge className={getStatusBadgeClass(statusInfo.variant)}>
                            {statusInfo.label}
                          </Badge>
                        );
                      })()}
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
    </div>
  );
}