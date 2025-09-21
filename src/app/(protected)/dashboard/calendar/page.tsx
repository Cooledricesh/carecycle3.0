'use client';

import { CalendarView } from '@/components/calendar/calendar-view';
import { FilterProvider } from '@/providers/filter-provider';
import { FilterBar } from '@/components/filters/FilterBar';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function CalendarPage() {
  const isMobile = useIsMobile();

  return (
    <FilterProvider persistToUrl={true}>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className={`text-2xl ${isMobile ? 'sm:text-3xl' : 'lg:text-3xl'} font-bold text-gray-900`}>
            캘린더 보기
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            날짜를 클릭하면 해당일의 상세 스케줄을 확인할 수 있습니다.
          </p>
        </div>

        {/* Filter Bar */}
        <FilterBar
          collapsible={false}
          showTitle={true}
          className="mb-4"
        />

        <CalendarView />
      </div>
    </FilterProvider>
  );
}