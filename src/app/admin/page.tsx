import { getCurrentUserProfile } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, BarChart3, Settings } from "lucide-react";

export default async function AdminPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return null; // This should be handled by the layout
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          관리자 대시보드
        </h1>
        <p className="text-gray-600">
          시스템 전체 현황을 확인하고 관리하세요.
        </p>
      </div>

      {/* Admin Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              +2 신규 가입 (이번 주)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 예약</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              +12% 전월 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 예약</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +8% 전월 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 상태</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              모든 서비스 정상 운영
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <CardDescription>
              시스템 내 최근 활동을 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">새로운 사용자 가입</p>
                  <p className="text-xs text-gray-500">김새로님이 가입했습니다.</p>
                </div>
                <span className="text-xs text-gray-500">5분 전</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">스케줄 업데이트</p>
                  <p className="text-xs text-gray-500">간호사 이미영님이 스케줄을 수정했습니다.</p>
                </div>
                <span className="text-xs text-gray-500">1시간 전</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">시스템 백업</p>
                  <p className="text-xs text-gray-500">자동 백업이 완료되었습니다.</p>
                </div>
                <span className="text-xs text-gray-500">3시간 전</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>부서별 현황</CardTitle>
            <CardDescription>
              각 부서의 스케줄 현황을 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">내과</p>
                  <p className="text-sm text-gray-600">12명의 간호사</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">15건</p>
                  <p className="text-sm text-gray-600">오늘 예약</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">외과</p>
                  <p className="text-sm text-gray-600">8명의 간호사</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">10건</p>
                  <p className="text-sm text-gray-600">오늘 예약</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">응급실</p>
                  <p className="text-sm text-gray-600">6명의 간호사</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">22건</p>
                  <p className="text-sm text-gray-600">오늘 예약</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}