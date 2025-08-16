import { getCurrentUserProfile } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return null; // This should be handled by the layout
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {profile.name}님
        </h1>
        <p className="text-gray-600">
          오늘의 스케줄을 확인해보세요.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 예정</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              3건 완료, 2건 대기
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행 중</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              현재 진행 중인 예약
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              오늘 완료된 예약
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">알림</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              새로운 알림
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>최근 스케줄</CardTitle>
          <CardDescription>
            최근 예약된 환자 스케줄을 확인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">김영희 환자</h4>
                <p className="text-sm text-gray-600">정기 검진 • 14:30</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                  완료
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">박철수 환자</h4>
                <p className="text-sm text-gray-600">치료 • 15:00</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                  진행 중
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">이미영 환자</h4>
                <p className="text-sm text-gray-600">상담 • 16:00</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                  예정
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}