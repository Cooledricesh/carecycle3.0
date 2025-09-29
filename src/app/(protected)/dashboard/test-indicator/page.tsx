'use client';

import { ScheduleIndicator, ScheduleIndicatorVertical } from '@/components/schedules/ScheduleIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestIndicatorPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Schedule Indicator Test Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Different Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">All schedules completed on time:</p>
            <ScheduleIndicator completedCount={5} overdueCount={0} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Mixed: Some completed, some overdue:</p>
            <ScheduleIndicator completedCount={3} overdueCount={2} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Only overdue schedules:</p>
            <ScheduleIndicator completedCount={0} overdueCount={4} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">With scheduled items:</p>
            <ScheduleIndicator completedCount={2} overdueCount={1} scheduledCount={3} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Empty (should not display):</p>
            <ScheduleIndicator completedCount={0} overdueCount={0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Different Sizes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Compact size:</p>
            <ScheduleIndicator completedCount={5} overdueCount={3} size="compact" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Default size:</p>
            <ScheduleIndicator completedCount={5} overdueCount={3} size="default" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Large size:</p>
            <ScheduleIndicator completedCount={5} overdueCount={3} size="large" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>With Labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">With labels (desktop only):</p>
            <ScheduleIndicator completedCount={5} overdueCount={3} showLabels={true} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Large with labels:</p>
            <ScheduleIndicator completedCount={5} overdueCount={3} size="large" showLabels={true} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vertical Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Vertical layout for constrained spaces:</p>
            <div className="w-20">
              <ScheduleIndicatorVertical completedCount={5} overdueCount={3} scheduledCount={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => {
              const day = (i % 31) + 1;
              const hasSchedules = Math.random() > 0.5;
              const completed = hasSchedules ? Math.floor(Math.random() * 3) : 0;
              const overdue = hasSchedules ? Math.floor(Math.random() * 2) : 0;
              const scheduled = hasSchedules ? Math.floor(Math.random() * 2) : 0;

              return (
                <div
                  key={i}
                  className={`
                    border rounded p-2 min-h-[80px] space-y-1
                    ${overdue > 0 ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">{day}</span>
                    <ScheduleIndicator
                      completedCount={completed}
                      overdueCount={overdue}
                      scheduledCount={scheduled}
                      size="compact"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}