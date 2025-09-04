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
  isToday,
  parseISO
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSchedules } from '@/hooks/useSchedules';
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
  
  // 현재 월의 스케줄 데이터 가져오기
  const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  
  const { data: schedules = [], isLoading } = useSchedules({
    dateRange: { start: startDate, end: endDate }
  });

  // 캘린더 날짜 계산
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: ko });
    const calendarEnd = endOfWeek(monthEnd, { locale: ko });

    const days: CalendarDay[] = [];
    let currentDay = calendarStart;

    while (currentDay <= calendarEnd) {
      const schedulesByDay = schedules.filter(schedule => {
        const scheduleDate = safeParse(schedule.nextDueDate);
        return scheduleDate && isSameDay(scheduleDate, currentDay);
      });

      days.push({
        date: currentDay,
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, 'yyyy년 MMMM', { locale: ko })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div 
                key={day} 
                className={`p-2 text-center text-sm font-medium ${
                  index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`
                  min-h-[80px] p-1 border rounded cursor-pointer transition-colors
                  ${day.isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 text-gray-400'}
                  ${selectedDate && isSameDay(day.date, selectedDate) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                  ${isToday(day.date) ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}
                `}
                onClick={() => handleDateClick(day.date)}
              >
                {/* 날짜 숫자 */}
                <div className={`text-sm font-medium mb-1 ${
                  isToday(day.date) ? 'text-blue-700' : 
                  day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {format(day.date, 'd')}
                </div>

                {/* 스케줄 표시 */}
                <div className="space-y-0.5">
                  {day.schedules.slice(0, 2).map((schedule) => (
                    <Popover key={schedule.id}>
                      <PopoverTrigger asChild>
                        <div className={`
                          text-xs px-1 py-0.5 rounded truncate cursor-pointer
                          ${getScheduleStatusColor(schedule.status)}
                        `}>
                          {schedule.patient?.name} • {schedule.item?.name}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" side="top">
                        <div className="space-y-2">
                          <h4 className="font-semibold">{schedule.patient?.name}</h4>
                          <p className="text-sm text-gray-600">{schedule.item?.name}</p>
                          <p className="text-sm text-gray-500">
                            예정일: {safeFormatDate(schedule.nextDueDate, 'yyyy년 MM월 dd일')}
                          </p>
                          {schedule.intervalWeeks && (
                            <p className="text-sm text-gray-500">
                              주기: {schedule.intervalWeeks}주마다
                            </p>
                          )}
                          {schedule.notes && (
                            <p className="text-sm text-gray-500">메모: {schedule.notes}</p>
                          )}
                          <Badge variant="secondary" className={getScheduleStatusColor(schedule.status)}>
                            {schedule.status === 'active' ? '활성' :
                             schedule.status === 'paused' ? '일시중지' :
                             schedule.status === 'completed' ? '완료' :
                             schedule.status === 'cancelled' ? '취소' : schedule.status}
                          </Badge>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                  
                  {/* 더 많은 스케줄이 있는 경우 표시 */}
                  {day.schedules.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{day.schedules.length - 2}개 더
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 선택된 날짜의 스케줄 상세 */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })} 일정
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateSchedules.length === 0 ? (
              <p className="text-gray-500 text-center py-4">이 날에는 예정된 스케줄이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {selectedDateSchedules.map((schedule) => (
                  <div key={schedule.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">{schedule.patient?.name}</h4>
                        <p className="text-sm text-gray-600">
                          {schedule.item?.name} • {schedule.item?.category}
                        </p>
                        {schedule.intervalWeeks && (
                          <p className="text-sm text-gray-500">
                            주기: {schedule.intervalWeeks}주마다
                          </p>
                        )}
                        {schedule.assignedNurse && (
                          <p className="text-sm text-gray-500">
                            담당: {schedule.assignedNurse.name}
                          </p>
                        )}
                        {schedule.notes && (
                          <p className="text-sm text-gray-500">메모: {schedule.notes}</p>
                        )}
                      </div>
                      <Badge className={getScheduleStatusColor(schedule.status)}>
                        {schedule.status === 'active' ? '활성' :
                         schedule.status === 'paused' ? '일시중지' :
                         schedule.status === 'completed' ? '완료' :
                         schedule.status === 'cancelled' ? '취소' : schedule.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}