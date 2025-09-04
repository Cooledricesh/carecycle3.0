'use client';

import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  isToday
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSchedules } from '@/hooks/useSchedules';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ScheduleWithDetails } from '@/types/schedule';
import { safeFormatDate, safeParse } from '@/lib/utils/date';

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
  
  // 모바일 상태 확인
  const isMobile = useIsMobile();
  
  // 모든 스케줄 데이터 가져오기
  const { schedules = [], isLoading } = useSchedules();

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
        if (!schedule.nextDueDate) return false;
        const scheduleDate = safeParse(schedule.nextDueDate);
        return scheduleDate && isSameDay(scheduleDate, currentDay);
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

  // 선택된 날짜의 스케줄
  const selectedDateSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return schedules.filter(schedule => {
      const scheduleDate = safeParse(schedule.nextDueDate);
      return scheduleDate && isSameDay(scheduleDate, selectedDate);
    });
  }, [selectedDate, schedules]);

  // 월별 통계
  const monthlyStats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const monthSchedules = schedules.filter(schedule => {
      const scheduleDate = safeParse(schedule.nextDueDate);
      return scheduleDate && scheduleDate >= monthStart && scheduleDate <= monthEnd;
    });

    const activeCount = monthSchedules.filter(s => s.status === 'active').length;
    const overdueCount = monthSchedules.filter(s => {
      const scheduleDate = safeParse(s.nextDueDate);
      return scheduleDate && scheduleDate < new Date() && s.status === 'active';
    }).length;
    const completedCount = monthSchedules.filter(s => s.status === 'completed').length;
    const totalCount = monthSchedules.length;
    const daysWithSchedules = calendarDays.filter(day => day.schedules.length > 0).length;

    return {
      total: totalCount,
      active: activeCount,
      overdue: overdueCount,
      completed: completedCount,
      daysWithSchedules
    };
  }, [currentDate, schedules, calendarDays]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
    setSelectedDate(null);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const getScheduleStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
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
            <CardTitle className={`font-semibold flex items-center gap-2 ${
              isMobile ? 'text-lg' : 'text-xl'
            }`}>
              <Calendar className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              {format(currentDate, 'yyyy년 MMMM', { locale: ko })}
            </CardTitle>
            
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
          
          {/* 월별 통계 - 모바일에서 2x3 그리드 */}
          <div className={`grid gap-3 mt-4 pt-4 border-t ${
            isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-5'
          }`}>
            <div className="text-center p-2">
              <div className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {monthlyStats.total}
              </div>
              <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                전체 스케줄
              </div>
            </div>
            <div className="text-center p-2">
              <div className={`font-semibold text-green-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {monthlyStats.active}
              </div>
              <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                활성 스케줄
              </div>
            </div>
            <div className="text-center p-2">
              <div className={`font-semibold text-red-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {monthlyStats.overdue}
              </div>
              <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                연체 스케줄
              </div>
            </div>
            <div className="text-center p-2">
              <div className={`font-semibold text-blue-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {monthlyStats.completed}
              </div>
              <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                완료된 스케줄
              </div>
            </div>
            <div className={`text-center p-2 ${isMobile ? 'col-span-2' : ''}`}>
              <div className={`font-semibold text-purple-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {monthlyStats.daysWithSchedules}
              </div>
              <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                스케줄이 있는 일수
              </div>
            </div>
          </div>
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
            {calendarDays.map((day, index) => {
              const dayScheduleCount = day.schedules.length;
              const hasActiveSchedules = day.schedules.some(s => s.status === 'active');
              const hasOverdueSchedules = day.schedules.some(s => {
                const scheduleDate = safeParse(s.nextDueDate);
                return scheduleDate && scheduleDate < new Date() && s.status === 'active';
              });
              
              return (
                <div
                  key={index}
                  className={`
                    ${isMobile ? 'min-h-[70px] p-1' : 'min-h-[90px] p-2'} 
                    border rounded-lg cursor-pointer transition-all duration-200
                    ${isMobile ? 'min-w-[44px] hover:bg-gray-100' : 'hover:bg-gray-50'}
                    ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50 text-gray-400'}
                    ${selectedDate && isSameDay(day.date, selectedDate) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                    ${isToday(day.date) ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}
                    ${hasOverdueSchedules ? 'border-red-300 bg-red-50/30' : ''}
                    hover:shadow-sm active:scale-95
                  `}
                  onClick={() => handleDateClick(day.date)}
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
                    
                    {/* 스케줄 카운트 뱃지 - 모바일에서 더 작게 */}
                    {dayScheduleCount > 0 && (
                      <div className={`
                        ${isMobile ? 'text-xs px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} 
                        rounded-full font-medium flex items-center gap-0.5
                        ${hasOverdueSchedules ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'}
                      `}>
                        {hasOverdueSchedules && (
                          <AlertCircle className={`${isMobile ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} />
                        )}
                        {dayScheduleCount}
                      </div>
                    )}
                  </div>

                  {/* 스케줄 유형별 카운트 - 모바일에서 더 컴팩트하게 */}
                  <div className={`flex flex-wrap ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
                    {(() => {
                      const injectionCount = day.schedules.filter(s => s.item?.category === 'injection').length;
                      const testCount = day.schedules.filter(s => s.item?.category === 'test').length;
                      
                      return (
                        <>
                          {injectionCount > 0 && (
                            <div className={`
                              ${isMobile ? 'text-xs px-1 py-0.5' : 'text-xs px-2 py-1'} 
                              rounded-full bg-blue-500 text-white font-medium
                            `}>
                              {isMobile ? `주${injectionCount}` : `주사 ${injectionCount}`}
                            </div>
                          )}
                          {testCount > 0 && (
                            <div className={`
                              ${isMobile ? 'text-xs px-1 py-0.5' : 'text-xs px-2 py-1'} 
                              rounded-full bg-green-500 text-white font-medium
                            `}>
                              {isMobile ? `검${testCount}` : `검사 ${testCount}`}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
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
                {selectedDateSchedules
                  .sort((a, b) => {
                    // 우선순위별 정렬: 연체 > 활성 > 기타
                    const getStatusPriority = (status: string) => {
                      if (status === 'active') return 1;
                      if (status === 'paused') return 2;
                      if (status === 'completed') return 3;
                      if (status === 'cancelled') return 4;
                      return 5;
                    };
                    
                    const aOverdue = safeParse(a.nextDueDate) && safeParse(a.nextDueDate)! < new Date() && a.status === 'active';
                    const bOverdue = safeParse(b.nextDueDate) && safeParse(b.nextDueDate)! < new Date() && b.status === 'active';
                    
                    if (aOverdue && !bOverdue) return -1;
                    if (!aOverdue && bOverdue) return 1;
                    
                    return getStatusPriority(a.status) - getStatusPriority(b.status);
                  })
                  .map((schedule) => {
                    const scheduleDate = safeParse(schedule.nextDueDate);
                    const isOverdue = scheduleDate && scheduleDate < new Date() && schedule.status === 'active';
                    
                    return (
                      <div 
                        key={schedule.id} 
                        className={`
                          ${isMobile ? 'p-3' : 'p-4'} border rounded-lg transition-all hover:shadow-sm
                          ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-3'}`}>
                          <div className={`space-y-1 ${isMobile ? 'flex-1' : 'space-y-2'}`}>
                            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
                              <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : ''}`}>
                                {schedule.patient?.name}
                              </h4>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                                  연체
                                </Badge>
                              )}
                            </div>
                            <div className={`flex items-center gap-2 text-gray-600 ${
                              isMobile ? 'text-xs' : 'text-sm'
                            }`}>
                              <span className="font-medium">{schedule.item?.name}</span>
                              {schedule.item?.category && (
                                <>
                                  <span>•</span>
                                  <span>{schedule.item.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge className={`${getScheduleStatusColor(schedule.status)} ${
                            isMobile ? 'text-xs' : ''
                          }`}>
                            {schedule.status === 'active' ? '활성' :
                             schedule.status === 'paused' ? '일시중지' :
                             schedule.status === 'completed' ? '완료' :
                             schedule.status === 'cancelled' ? '취소' : schedule.status}
                          </Badge>
                        </div>
                        
                        <div className={`grid gap-3 ${
                          isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 md:grid-cols-2 gap-4 text-sm'
                        }`}>
                          {schedule.intervalWeeks && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Clock className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                              <span>주기: {schedule.intervalWeeks}주마다</span>
                            </div>
                          )}
                          {schedule.assignedNurse && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <span className="font-medium">담당:</span>
                              <span>{schedule.assignedNurse.name}</span>
                            </div>
                          )}
                        </div>
                        
                        {schedule.notes && (
                          <div className={`${isMobile ? 'mt-2 p-2' : 'mt-3 p-3'} bg-gray-50 rounded text-gray-600 ${
                            isMobile ? 'text-xs' : 'text-sm'
                          }`}>
                            <span className="font-medium text-gray-700">메모:</span> {schedule.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}