'use client';

import { CalendarView } from '@/components/calendar/calendar-view';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function CalendarPage() {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className={`text-2xl ${isMobile ? 'sm:text-3xl' : 'lg:text-3xl'} font-bold text-gray-900`}>
          캘린더 보기
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          월별 스케줄을 캘린더 형태로 확인하세요.
        </p>
      </div>
      
      <CalendarView />
    </div>
  );
}