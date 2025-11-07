'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { differenceInWeeks } from 'date-fns';
import { ScheduleResumeDialog } from '@/components/schedules/schedule-resume-dialog';
import type { ResumeOptions } from '@/lib/schedule-management/schedule-state-manager';
import { ScheduleDateCalculator } from '@/lib/schedule-management/schedule-date-calculator';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertCircle, ChevronUp, ChevronDown, Users, User } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useScheduleCompletion } from '@/hooks/useScheduleCompletion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCalendarSchedules } from '@/hooks/useCalendarSchedules';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CalendarDayCard } from '@/components/calendar/calendar-day-card';
import { ScheduleCompletionDialog } from '@/components/schedules/schedule-completion-dialog';
import { ScheduleEditModal } from '@/components/schedules/schedule-edit-modal';
import { getScheduleStatusLabel, sortSchedulesByPriority } from '@/lib/utils/schedule-status';
import type { ScheduleWithDetails, Schedule } from '@/types/schedule';
import type { ScheduleStatus } from '@/lib/database.types';
import { safeFormatDate, safeParse } from '@/lib/utils/date';
import { scheduleService } from '@/services/scheduleService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { mapErrorToUserMessage } from '@/lib/error-mapper';
import { createClient } from '@/lib/supabase/client';
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced';
import { useFilterContext } from '@/lib/filters/filter-context';
import { Check } from 'lucide-react';
import { useScheduleRefetch } from '@/hooks/useScheduleRefetch';
import { eventManager } from '@/lib/events/schedule-event-manager';
import { ScheduleIndicator } from '@/components/schedules/ScheduleIndicator';

interface CalendarViewProps {
  className?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  schedules: ScheduleWithDetails[];
}

export function CalendarView({ className }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // 모바일 상태 확인
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { filters } = useFilterContext();
  const { data: profile } = useProfile();

  useScheduleRefetch();

  // 캘린더용 스케줄 데이터 가져오기 (완료 이력 포함)
  const { data: schedules = [], isLoading, refetch } = useCalendarSchedules(currentDate);

  // 완료 처리 훅 사용
  const {
    selectedSchedule,
    executionDate,
    executionNotes,
    isSubmitting,
    isDialogOpen,
    handleComplete,
    handleSubmit: originalHandleSubmit,
    setExecutionDate,
    setExecutionNotes,
    setDialogOpen
  } = useScheduleCompletion();

  const handleSubmit = async () => {
    await originalHandleSubmit();
    scheduleServiceEnhanced.clearCache();
    eventManager.emitScheduleChange();
  };


  // 캘린더 날짜 계산
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: ko });
    const calendarEnd = endOfWeek(monthEnd, { locale: ko });

    const days: CalendarDay[] = [];
    let currentDay = calendarStart;

    while (currentDay <= calendarEnd) {
      // 날짜별 스케줄 필터링
      const schedulesByDay = schedules.filter(schedule => {
        const dueDateValue = schedule.next_due_date;
        if (!dueDateValue) {
          return false;
        }
        const scheduleDate = safeParse(dueDateValue);
        const isMatch = scheduleDate && isSameDay(scheduleDate, currentDay);
        return isMatch;
      });

      days.push({
        date: new Date(currentDay),
        isCurrentMonth: isSameMonth(currentDay, currentDate),
        schedules: schedulesByDay,
      });

      currentDay = addDays(currentDay, 1);
    }

    return days;
  }, [currentDate, schedules]);

  // 선택된 날짜의 스케줄 (우선순위로 정렬)
  const selectedDateSchedules = useMemo(() => {
    if (!selectedDate) return [];

    const daySchedules = schedules.filter(schedule => {
      const dueDateValue = schedule.next_due_date;
      if (!dueDateValue) return false;
      const scheduleDate = safeParse(dueDateValue);
      return scheduleDate && isSameDay(scheduleDate, selectedDate);
    });

    return sortSchedulesByPriority(daySchedules);
  }, [selectedDate, schedules]);

  // 월별 통계
  const monthlyStats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { locale: ko });
    const weekEnd = endOfWeek(today, { locale: ko });

    const monthSchedules = schedules.filter(schedule => {
      const dueDateValue = schedule.next_due_date;
      if (!dueDateValue) return false;
      const scheduleDate = safeParse(dueDateValue);
      return scheduleDate && scheduleDate >= monthStart && scheduleDate <= monthEnd;
    });

    // 기존 통계
    const activeCount = monthSchedules.filter(s => s.status === 'active').length;
    const totalCount = monthSchedules.length;
    const daysWithSchedules = calendarDays.filter(day => day.isCurrentMonth && day.schedules.some(s => s.status === 'active')).length;

    // 연체된 스케줄 (오늘 이전의 활성 스케줄) - 월별 통계이므로 monthSchedules 사용
    const overdueCount = monthSchedules.filter(s => {
      // 타임존 안전한 문자열 비교 사용
      const todayString = format(today, 'yyyy-MM-dd');
      return s.status === 'active' && s.next_due_date && s.next_due_date < todayString;
    }).length;

    // 오늘 예정 스케줄 - 월별 통계에 포함
    const todayCount = monthSchedules.filter(s => {
      const todayString = format(today, 'yyyy-MM-dd');
      return s.status === 'active' && s.next_due_date === todayString;
    }).length;

    // 이번주 예정 스케줄 - 월별 통계에 포함
    const weekStartString = format(weekStart, 'yyyy-MM-dd');
    const weekEndString = format(weekEnd, 'yyyy-MM-dd');
    const weekCount = monthSchedules.filter(s => {
      return s.status === 'active' && s.next_due_date &&
             s.next_due_date >= weekStartString && s.next_due_date <= weekEndString;
    }).length;

    return {
      total: totalCount,
      active: activeCount,
      overdue: overdueCount,
      today: todayCount,
      week: weekCount,
      daysWithSchedules
    };
  }, [currentDate, schedules, calendarDays]);

  // 이번달 완료 횟수 - 이미 가져온 schedules 데이터에서 계산
  const monthlyExecutions = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // RPC 함수에서 이미 가져온 데이터에서 completed 타입만 필터링
    const completedSchedules = schedules.filter(schedule => {
      const displayType = (schedule as any).display_type;
      const dueDateValue = schedule.next_due_date;

      if (!dueDateValue || displayType !== 'completed') return false;

      const scheduleDate = safeParse(dueDateValue);
      return scheduleDate && scheduleDate >= monthStart && scheduleDate <= monthEnd;
    });

    return completedSchedules.length;
  }, [currentDate, schedules]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
    setSelectedDate(null);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };
  
  // 스케줄 액션 핸들러들
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available');
      }
      return scheduleService.updateStatus(id, status, profile.organization_id);
    },
    onSuccess: async (_, variables) => {
      toast({
        title: "성공",
        description: variables.status === 'paused'
          ? "스케줄이 보류되었습니다."
          : "스케줄이 재개되었습니다.",
      });

      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error);
      toast({
        title: "오류",
        description: message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available');
      }
      return scheduleService.delete(id, profile.organization_id);
    },
    onSuccess: async () => {
      toast({
        title: "성공",
        description: "스케줄이 삭제되었습니다.",
      });

      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error);
      toast({
        title: "오류",
        description: message,
        variant: "destructive"
      });
    }
  });

  const handlePauseSchedule = (id: string) => {
    statusMutation.mutate({ id, status: 'paused' });
  };

  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedScheduleForResume, setSelectedScheduleForResume] = useState<ScheduleWithDetails | null>(null);

  const handleResumeSchedule = (schedule: ScheduleWithDetails) => {
    setSelectedScheduleForResume(schedule);
    setResumeDialogOpen(true);
  };

  const handleConfirmResume = async (options: ResumeOptions) => {
    if (!selectedScheduleForResume) return;

    try {
      if (!profile?.organization_id) return;
      // Use id fallback to handle objects with either id or schedule_id
      const scheduleId = (selectedScheduleForResume as any).id || (selectedScheduleForResume as any).schedule_id;
      await scheduleService.resumeSchedule(scheduleId, profile.organization_id, options);

      toast({
        title: "성공",
        description: "스케줄이 재개되었습니다.",
      });

      setResumeDialogOpen(false);
      setSelectedScheduleForResume(null);

      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();
    } catch (error) {
      toast({
        title: "오류",
        description: mapErrorToUserMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말로 이 스케줄을 삭제하시겠습니까?')) {
      return;
    }
    deleteMutation.mutate(id);
  };

  // Refresh data function - 스케줄 관련 쿼리만 무효화
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-schedules'] });
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">캘린더를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 캘린더 헤더 */}
      <Card>
        <CardHeader className={`pb-3 ${isMobile ? 'px-3 py-4' : ''}`}>
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-3' : ''}`}>
            <div className="flex flex-col gap-1">
              <CardTitle className={`font-semibold flex items-center gap-2 ${
                isMobile ? 'text-lg' : 'text-xl'
              }`}>
                <Calendar className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {format(currentDate, 'yyyy년 MMMM', { locale: ko })}
              </CardTitle>

              {/* 필터 상태 표시 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {filters.showAll ? (
                  <>
                    <Users className="h-3 w-3" />
                    <span>전체 환자</span>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    <span>
                      {profile?.role === 'doctor' ? '내 환자' :
                       profile?.role === 'nurse' ? `${profile?.care_type || '소속'} 환자` :
                       '환자'}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* 네비게이션 버튼 - 모바일에서 더 크게 */}
            <div className={`flex items-center ${isMobile ? 'gap-2 w-full justify-center' : 'gap-1'}`}>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => navigateMonth('prev')}
                className={isMobile ? 'min-h-[44px] min-w-[44px]' : ''}
              >
                <ChevronLeft className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                {isMobile && <span className="ml-1">이전</span>}
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setCurrentDate(new Date())}
                className={isMobile ? 'min-h-[44px] px-4' : ''}
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => navigateMonth('next')}
                className={isMobile ? 'min-h-[44px] min-w-[44px]' : ''}
              >
                <ChevronRight className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                {isMobile && <span className="mr-1">다음</span>}
              </Button>
            </div>
          </div>
          
          {/* 모바일과 데스크톱 통계 조건부 렌더링 */}
          {isMobile ? (
            <>
              {/* 모바일: 압축형 통계 바 */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* 연체 (항상 표시) */}
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-600">{monthlyStats.overdue}</span>
                      <span className="text-xs text-gray-500">연체</span>
                    </div>

                    {/* 오늘 */}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-semibold text-blue-600">{monthlyStats.today}</span>
                      <span className="text-xs text-gray-500">오늘</span>
                    </div>

                    {/* 이번주 */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-semibold text-green-600">{monthlyStats.week}</span>
                      <span className="text-xs text-gray-500">이번주</span>
                    </div>
                  </div>

                  {/* 더보기 토글 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatsExpanded(!statsExpanded)}
                    className="min-h-[32px] min-w-[32px] p-1"
                  >
                    {statsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="sr-only">통계 {statsExpanded ? '접기' : '펼치기'}</span>
                  </Button>
                </div>

                {/* 확장된 통계 */}
                {statsExpanded && (
                  <div className="grid grid-cols-3 gap-2 mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-base font-semibold text-green-600">{monthlyStats.active}</div>
                      <div className="text-xs text-gray-500">활성</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-blue-600">{monthlyExecutions}</div>
                      <div className="text-xs text-gray-500">이번달 완료</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-purple-600">{monthlyStats.daysWithSchedules}</div>
                      <div className="text-xs text-gray-500">일정있는 날</div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 데스크톱: 전체 제거, 이번달 완료 추가 */
            <div className="grid gap-3 mt-4 pt-4 border-t grid-cols-2 md:grid-cols-4">
              <div className="text-center p-2">
                <div className="font-semibold text-green-600 text-lg">
                  {monthlyStats.active}
                </div>
                <div className="text-gray-500 text-xs">
                  활성 스케줄
                </div>
              </div>
              <div className="text-center p-2">
                <div className="font-semibold text-red-600 text-lg">
                  {monthlyStats.overdue}
                </div>
                <div className="text-gray-500 text-xs">
                  연체 스케줄
                </div>
              </div>
              <div className="text-center p-2">
                <div className="font-semibold text-blue-600 text-lg">
                  {monthlyExecutions}
                </div>
                <div className="text-gray-500 text-xs">
                  이번달 완료
                </div>
              </div>
              <div className="text-center p-2">
                <div className="font-semibold text-purple-600 text-lg">
                  {monthlyStats.daysWithSchedules}
                </div>
                <div className="text-gray-500 text-xs">
                  스케줄이 있는 일수
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className={isMobile ? 'px-2 pb-4' : ''}>
          {/* 요일 헤더 */}
          <div className={`grid grid-cols-7 mb-2 ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div 
                key={day} 
                className={`text-center font-medium ${
                  isMobile ? 'p-1 text-xs' : 'p-2 text-sm'
                } ${
                  index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 - 모바일에서 더 촘촘하게 */}
          <div className={`grid grid-cols-7 ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
            {calendarDays.map((day) => {
              // Calculate separate counts for different schedule types
              const completedSchedules = day.schedules.filter(s =>
                (s as any).display_type === 'completed'
              );
              const activeSchedules = day.schedules.filter(s =>
                (s as any).display_type !== 'completed' && s.status === 'active'
              );
              const overdueSchedules = activeSchedules.filter(s => {
                const statusInfo = getScheduleStatusLabel(s);
                return statusInfo.variant === 'overdue';
              });
              const normalSchedules = activeSchedules.filter(s => {
                const statusInfo = getScheduleStatusLabel(s);
                return statusInfo.variant !== 'overdue';
              });

              const completedCount = completedSchedules.length;
              const overdueCount = overdueSchedules.length;
              const scheduledCount = normalSchedules.length;
              const hasOverdueSchedules = overdueCount > 0;

              return (
                <button
                  key={format(day.date, 'yyyy-MM-dd')}
                  type="button"
                  className={`
                    ${isMobile ? 'min-h-[70px] p-1' : 'min-h-[90px] p-2'}
                    border-2 rounded-lg cursor-pointer transition-all duration-200 text-left
                    ${isMobile ? 'min-w-[44px]' : ''}
                    ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50 text-gray-400'}
                    ${selectedDate && isSameDay(day.date, selectedDate) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                    ${isToday(day.date) && !hasOverdueSchedules ? 'bg-blue-50 border-blue-400' : ''}
                    ${hasOverdueSchedules ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}
                    ${!hasOverdueSchedules && (isMobile ? 'hover:bg-gray-100' : 'hover:bg-gray-50')}
                    ${hasOverdueSchedules ? 'hover:bg-red-50' : ''}
                    hover:shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                  `}
                  onClick={() => handleDateClick(day.date)}
                  aria-pressed={selectedDate && isSameDay(day.date, selectedDate) ? true : undefined}
                  aria-label={`${format(day.date, 'yyyy년 M월 d일', { locale: ko })}${completedCount > 0 ? `, 완료 ${completedCount}건` : ''}${overdueCount > 0 ? `, 연체 ${overdueCount}건` : ''}${scheduledCount > 0 ? `, 예정 ${scheduledCount}건` : ''}${completedCount === 0 && overdueCount === 0 && scheduledCount === 0 ? ', 스케줄 없음' : ''}`}
                >
                  {/* 날짜 숫자와 스케줄 카운트 */}
                  <div className={`flex items-center justify-between ${isMobile ? 'mb-1' : 'mb-2'}`}>
                    <div className={`font-medium ${
                      isMobile ? 'text-xs' : 'text-sm'
                    } ${
                      isToday(day.date) ? 'text-blue-700' : 
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {format(day.date, 'd')}
                    </div>
                    
                    {/* Use ScheduleIndicator for clear separation */}
                    {(completedCount > 0 || overdueCount > 0 || scheduledCount > 0) && (
                      <ScheduleIndicator
                        completedCount={completedCount}
                        overdueCount={overdueCount}
                        scheduledCount={scheduledCount}
                        size={isMobile ? 'compact' : 'default'}
                        className="ml-auto"
                      />
                    )}
                  </div>

                  {/* 카테고리별 표시 (주사/검사) */}
                  {(() => {
                    const nonCompletedSchedules = day.schedules.filter(s =>
                      (s as any).display_type !== 'completed'
                    );
                    const injectionCount = nonCompletedSchedules.filter(s => {
                      const category = s.item_category;
                      return category === 'injection';
                    }).length;
                    const testCount = nonCompletedSchedules.filter(s => {
                      const category = s.item_category;
                      return category === 'test';
                    }).length;

                    if (injectionCount === 0 && testCount === 0) return null;

                    return (
                      <div className={`flex flex-wrap ${isMobile ? 'gap-0.5' : 'gap-1'} mt-1`}>
                        {injectionCount > 0 && (
                          <div className={`
                            ${isMobile ? 'text-xs px-1 py-0.5' : 'text-xs px-2 py-0.5'}
                            rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-200
                          `}>
                            {isMobile ? `주${injectionCount}` : `주사 ${injectionCount}`}
                          </div>
                        )}
                        {testCount > 0 && (
                          <div className={`
                            ${isMobile ? 'text-xs px-1 py-0.5' : 'text-xs px-2 py-0.5'}
                            rounded-full bg-emerald-50 text-emerald-600 font-medium border border-emerald-200
                          `}>
                            {isMobile ? `검${testCount}` : `검사 ${testCount}`}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 선택된 날짜의 스케줄 상세 */}
      {selectedDate && (
        <Card>
          <CardHeader className={isMobile ? 'px-3 py-4' : ''}>
            <CardTitle className={`flex items-center gap-2 ${
              isMobile ? 'text-base flex-col items-start' : 'text-lg'
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {format(selectedDate, isMobile ? 'MM월 dd일 (E)' : 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })} 일정
              </div>
              {selectedDateSchedules.length > 0 && (
                <Badge variant="secondary" className={`${isMobile ? 'mt-1' : 'ml-2'}`}>
                  총 {selectedDateSchedules.length}건
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'px-3 pb-4' : ''}>
            {selectedDateSchedules.length === 0 ? (
              <div className={`text-center ${isMobile ? 'py-6' : 'py-8'}`}>
                <Calendar className={`${isMobile ? 'h-8 w-8' : 'h-12 w-12'} text-gray-300 mx-auto mb-3`} />
                <p className={`text-gray-500 mb-2 ${isMobile ? 'text-sm' : ''}`}>
                  이 날에는 예정된 스케줄이 없습니다.
                </p>
                <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  다른 날짜를 선택해보세요.
                </p>
              </div>
            ) : (
              <div className={`space-y-3 ${isMobile ? 'max-h-[60vh] overflow-y-auto' : ''}`}>
                {selectedDateSchedules.map((schedule, index) => {
                  const displayType = (schedule as any).display_type || 'scheduled';
                  const executionId = (schedule as any).execution_id;
                  const scheduleId = schedule.schedule_id;
                  // Create unique key based on display type and relevant ID
                  const uniqueKey = displayType === 'completed' && executionId
                    ? `execution-${executionId}`
                    : `schedule-${scheduleId}-${index}`;

                  return (
                    <CalendarDayCard
                      key={uniqueKey}
                      schedule={schedule}
                      onComplete={() => handleComplete(schedule)}
                      onPause={() => handlePauseSchedule(scheduleId)}
                      onResume={() => handleResumeSchedule(schedule)}
                      onDelete={() => handleDeleteSchedule(scheduleId)}
                      onRefresh={refreshData}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
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

      {/* 재개 다이얼로그 */}
      {selectedScheduleForResume && (() => {
        // Calculate missed executions and pause duration
        const calculator = new ScheduleDateCalculator();
        // Transform ScheduleWithDetails to Schedule format
        const scheduleForCalculation: Schedule = {
          id: (selectedScheduleForResume as any).id || (selectedScheduleForResume as any).schedule_id,
          patientId: selectedScheduleForResume.patient_id,
          itemId: selectedScheduleForResume.item_id,
          intervalWeeks: selectedScheduleForResume.interval_weeks,
          startDate: selectedScheduleForResume.next_due_date, // Using next_due_date as startDate
          nextDueDate: selectedScheduleForResume.next_due_date,
          status: selectedScheduleForResume.status as ScheduleStatus,
          priority: selectedScheduleForResume.priority || 1,
          requiresNotification: false,
          notificationDaysBefore: 0,
          createdAt: selectedScheduleForResume.created_at,
          updatedAt: selectedScheduleForResume.updated_at,
          notes: selectedScheduleForResume.notes
        };

        // TODO: For better accuracy, consider using getSchedulePausedDate() from schedule-pause-utils
        // to fetch the actual pause date from schedule_logs
        const pausedDate = selectedScheduleForResume.updated_at ? new Date(selectedScheduleForResume.updated_at) : new Date();
        const resumeDate = new Date();
        const missedExecutions = selectedScheduleForResume.updated_at
          ? calculator.getMissedExecutions(scheduleForCalculation, pausedDate, resumeDate).length
          : 0;
        const pauseDuration = selectedScheduleForResume.updated_at
          ? Math.max(1, differenceInWeeks(resumeDate, pausedDate))
          : 1;

        return (
          <ScheduleResumeDialog
            open={resumeDialogOpen}
            onCancel={() => {
              setResumeDialogOpen(false);
              setSelectedScheduleForResume(null);
            }}
            onConfirm={handleConfirmResume}
            schedule={scheduleForCalculation}
            missedExecutions={missedExecutions}
            pauseDuration={pauseDuration}
          />
        );
      })()}
    </div>
  );
}