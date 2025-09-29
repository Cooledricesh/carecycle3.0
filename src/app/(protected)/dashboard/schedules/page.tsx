"use client";

import { useState } from "react";
import { Search, Trash2, Edit, AlertCircle, RefreshCw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCreateModal } from "@/components/schedules/schedule-create-modal";
import { ScheduleEditModal } from "@/components/schedules/schedule-edit-modal";
import { ScheduleResumeDialog } from '@/components/schedules/schedule-resume-dialog';
import { useFilteredSchedules } from "@/hooks/useFilteredSchedules";
import { useOverdueSchedules } from "@/hooks/useSchedules";
import { getScheduleCategoryIcon, getScheduleCategoryColor, getScheduleCategoryBgColor, getScheduleCategoryLabel, getScheduleCardBgColor } from '@/lib/utils/schedule-category';
import { scheduleService } from "@/services/scheduleService";
import type { ScheduleWithDetails } from "@/types/schedule";
import type { ItemCategory } from "@/lib/database.types";
import { format, differenceInWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mapErrorToUserMessage } from "@/lib/error-mapper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/useIsMobile";
import { touchTarget, responsiveText, responsivePadding, cn } from "@/lib/utils";
import { FilterProvider } from "@/providers/filter-provider";
import { SimpleFilterToggle } from "@/components/filters/SimpleFilterToggle";
import { useProfile } from "@/hooks/useProfile";
import { useFilterContext } from "@/lib/filters/filter-context";
import { useAuth } from "@/providers/auth-provider-simple";
import { scheduleServiceEnhanced } from "@/services/scheduleServiceEnhanced";
import { eventManager } from "@/lib/events/schedule-event-manager";

// Schedule type used in this component that supports both snake_case and camelCase
// Represents the transformed data from useFilteredSchedules
interface ScheduleItem {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  patient?: {
    id?: string;
    name?: string;
    careType?: string;
    care_type?: string;
    patientNumber?: string;
    patient_number?: string;
    doctorId?: string;
    doctor_id?: string;
  } | null;
  item?: {
    id?: string;
    name?: string;
    category?: string;
  } | null;
  intervalWeeks: number;
  interval_weeks?: number;
  nextDueDate: string;
  next_due_date?: string;
  notes?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// Helper function to map ScheduleWithDetails to ScheduleItem
function mapScheduleWithDetailsToItem(schedule: ScheduleWithDetails, index?: number): ScheduleItem {
  // Generate a robust unique ID
  const generateId = () => {
    if (schedule.schedule_id) {
      return schedule.schedule_id;
    }

    // Create a fallback ID using available fields with proper fallbacks
    const patientPart = schedule.patient_id || schedule.patient_name?.replace(/\s+/g, '') || 'unknown-patient';
    const itemPart = schedule.item_id || schedule.item_name?.replace(/\s+/g, '') || 'unknown-item';
    const datePart = schedule.next_due_date || new Date().toISOString().split('T')[0];
    const indexPart = index !== undefined ? `-${index}` : '';

    return `temp-${patientPart}-${itemPart}-${datePart}${indexPart}`;
  };

  // Handle both flat structure (from scheduleServiceEnhanced) and nested structure (from scheduleService)
  const patientName = schedule.patient_name || schedule.patient?.name || '환자 정보 없음';
  const patientCareType = schedule.patient_care_type || schedule.patient?.careType || schedule.patient?.care_type;
  const patientNumber = schedule.patient_number || schedule.patient?.patientNumber || schedule.patient?.patient_number;
  const doctorId = schedule.doctor_id || schedule.patient?.doctorId || schedule.patient?.doctor_id;

  const itemName = schedule.item_name || schedule.item?.name || '항목 정보 없음';
  const itemCategory = schedule.item_category || schedule.item?.category;
  const itemId = schedule.item_id || schedule.item?.id;

  const intervalWeeks = schedule.interval_weeks || schedule.intervalWeeks || 0;
  const nextDueDate = schedule.next_due_date || schedule.nextDueDate || '';
  const createdAt = schedule.created_at || schedule.createdAt;
  const updatedAt = schedule.updated_at || schedule.updatedAt;

  return {
    id: generateId(),
    status: (schedule.status as any) || 'active',
    patient: {
      name: patientName,
      careType: patientCareType,
      care_type: patientCareType,
      patientNumber: patientNumber,
      patient_number: patientNumber,
      doctorId: doctorId,
      doctor_id: doctorId
    },
    item: {
      id: itemId,
      name: itemName,
      category: itemCategory as ItemCategory
    },
    intervalWeeks: intervalWeeks,
    interval_weeks: intervalWeeks,
    nextDueDate: nextDueDate,
    next_due_date: nextDueDate,
    notes: schedule.notes,
    createdAt: createdAt,
    created_at: createdAt,
    updatedAt: updatedAt,
    updated_at: updatedAt
  };
}

function SchedulesContent() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();
  const { filters } = useFilterContext();
  const { user } = useAuth();

  const { schedules, isLoading: schedulesLoading, error: schedulesError, refetch: refetchSchedules } = useFilteredSchedules();
  const { data: overdueSchedules = [], isLoading: overdueLoading, error: overdueError, refetch: refetchOverdue } = useOverdueSchedules();


  const loading = schedulesLoading || overdueLoading;
  const error = schedulesError || overdueError;

  const deleteMutation = useMutation({
    mutationFn: scheduleService.delete,
    onSuccess: async () => {
      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();

      toast({
        title: "성공",
        description: "스케줄이 삭제되었습니다.",
      });

      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
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

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말로 이 스케줄을 삭제하시겠습니까?')) {
      return;
    }
    deleteMutation.mutate(id);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) =>
      scheduleService.updateStatus(id, status),
    onSuccess: async (_, variables) => {
      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();

      toast({
        title: "성공",
        description: variables.status === 'paused'
          ? "스케줄이 일시중지되었습니다."
          : "스케줄이 재개되었습니다.",
      });

      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
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
  const [selectedScheduleForResume, setSelectedScheduleForResume] = useState<ScheduleItem | null>(null);

  const handleResumeSchedule = (schedule: ScheduleItem) => {
    setSelectedScheduleForResume(schedule);
    setResumeDialogOpen(true);
  };

  const handleConfirmResume = async (options: { strategy: 'custom' | 'immediate' | 'next_cycle'; customDate?: Date; handleMissed?: 'skip' | 'catch_up' | 'mark_overdue' }) => {
    if (!selectedScheduleForResume) return;

    try {
      await scheduleService.resumeSchedule(selectedScheduleForResume.id, options);

      scheduleServiceEnhanced.clearCache();
      eventManager.emitScheduleChange();

      toast({
        title: "성공",
        description: "스케줄이 재개되었습니다.",
      });

      setResumeDialogOpen(false);
      setSelectedScheduleForResume(null);

      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
    } catch (error) {
      toast({
        title: "오류",
        description: "스케줄 재개에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const filteredSchedules = (schedules as ScheduleItem[]).filter((schedule: ScheduleItem) => {
    const matchesSearch =
      schedule.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.item?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab =
      selectedTab === "all" ||
      (selectedTab === "active" && schedule.status === 'active') ||
      (selectedTab === "paused" && schedule.status === 'paused') ||
      (selectedTab === "overdue" && overdueSchedules.some((o) => (o as any).id === schedule.id || o.schedule_id === schedule.id));

    return matchesSearch && matchesTab;
  });

  // Map overdueSchedules to ScheduleItem format when needed
  const mappedOverdueSchedules: ScheduleItem[] = overdueSchedules.map((schedule, index) =>
    mapScheduleWithDetailsToItem(schedule, index)
  );
  const displaySchedules: ScheduleItem[] = selectedTab === "overdue" ? mappedOverdueSchedules : filteredSchedules;

  const getStatusBadge = (schedule: ScheduleItem) => {
    if (schedule.status === 'paused') {
      return <Badge variant="secondary">일시중지</Badge>;
    }
    if (schedule.status === 'completed') {
      return <Badge variant="outline">완료</Badge>;
    }
    if (overdueSchedules.some((o) => o.schedule_id === schedule.id)) {
      return <Badge variant="destructive">지연</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">활성</Badge>;
  };

  return (
    <div className={`${responsivePadding.page} space-y-4 sm:space-y-6`}>
      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'}`}>
        <div>
          <h1 className={`${responsiveText.h1} font-bold`}>스케줄 관리</h1>
          <p className="text-xs sm:text-base text-gray-500 mt-1">
            모든 환자의 반복 검사 및 주사 스케줄을 관리합니다
          </p>
        </div>
        <div className={isMobile ? 'w-full' : ''}>
          <ScheduleCreateModal
            triggerClassName={`${isMobile ? 'w-full' : ''}`}
          />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10 pointer-events-none" />
          <Input
            placeholder={isMobile ? "검색..." : "환자명 또는 검사/주사명으로 검색..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`!pl-20 ${touchTarget.input}`}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className={cn(
          "w-full",
          isMobile && "bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4"
        )}>
          <TabsList className={cn(
            "grid w-full",
            isMobile ? "grid-cols-2 gap-2 h-auto bg-transparent p-0" : "grid-cols-4"
          )}>
            <TabsTrigger
              value="all"
              className={cn(
                "text-xs sm:text-sm",
                isMobile && "h-12 bg-white border border-gray-200 data-[state=active]:bg-blue-50 data-[state=active]:border-blue-300 data-[state=active]:text-blue-700"
              )}
            >
              전체 ({schedules.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className={cn(
                "text-xs sm:text-sm",
                isMobile && "h-12 bg-white border border-gray-200 data-[state=active]:bg-blue-50 data-[state=active]:border-blue-300 data-[state=active]:text-blue-700"
              )}
            >
              활성 ({schedules.filter(s => s.status === 'active').length})
            </TabsTrigger>
            <TabsTrigger
              value="paused"
              className={cn(
                "text-xs sm:text-sm",
                isMobile && "h-12 bg-white border border-gray-200 data-[state=active]:bg-blue-50 data-[state=active]:border-blue-300 data-[state=active]:text-blue-700"
              )}
            >
              일시중지 ({schedules.filter(s => s.status === 'paused').length})
            </TabsTrigger>
            <TabsTrigger
              value="overdue"
              className={cn(
                "text-xs sm:text-sm",
                isMobile && "h-12 bg-white border border-gray-200 data-[state=active]:bg-orange-50 data-[state=active]:border-orange-300 data-[state=active]:text-orange-700"
              )}
            >
              지연 ({overdueSchedules.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={selectedTab} className={cn(
          "space-y-4",
          isMobile ? "mt-0" : "mt-2"
        )}>
          <Card>
            <CardHeader className={isMobile ? 'p-4' : ''}>
              <CardTitle className={responsiveText.h3}>스케줄 목록</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {selectedTab === 'overdue' 
                  ? '오늘까지 처리해야 할 지연된 스케줄입니다.'
                  : '등록된 모든 스케줄을 확인하고 관리할 수 있습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>스케줄을 불러오는 중 오류가 발생했습니다.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        scheduleServiceEnhanced.clearCache();
                        refetchSchedules();
                        refetchOverdue();
                      }}
                      className="ml-4"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      다시 시도
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : displaySchedules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {selectedTab === 'overdue' 
                    ? '지연된 스케줄이 없습니다.'
                    : '등록된 스케줄이 없습니다.'}
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card Layout
                    <div className="space-y-3">
                      {displaySchedules.map((scheduleItem, index) => {
                        // Generate guaranteed unique key
                        const uniqueKey = `schedule-card-${scheduleItem.id}-${index}`;
                        return (
                        <Card key={uniqueKey} className={`p-4 ${getScheduleCardBgColor(scheduleItem.item?.category as ItemCategory)}`}>
                          <div className="space-y-3">
                            {/* Schedule Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-medium text-base">
                                  {scheduleItem.patient?.name || '환자 정보 없음'}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  {(() => {
                                    const IconComponent = getScheduleCategoryIcon(scheduleItem.item?.category as ItemCategory);
                                    return IconComponent ? (
                                      <IconComponent className={`h-4 w-4 ${getScheduleCategoryColor(scheduleItem.item?.category as ItemCategory)}`} />
                                    ) : null;
                                  })()}
                                  <span>{scheduleItem.item?.name || '항목 정보 없음'}</span>
                                  {scheduleItem.item?.category && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${getScheduleCategoryBgColor(scheduleItem.item?.category as ItemCategory)} ${getScheduleCategoryColor(scheduleItem.item?.category as ItemCategory)}`}>
                                      {getScheduleCategoryLabel(scheduleItem.item.category as ItemCategory)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {getStatusBadge(scheduleItem)}
                            </div>
                            
                            {/* Schedule Details */}
                            <div className="flex flex-col gap-1 text-sm text-gray-600">
                              <div className="flex justify-between">
                                <span>주기</span>
                                <span className="font-medium">{scheduleItem.intervalWeeks || scheduleItem.interval_weeks || 0}주</span>
                              </div>
                              <div className="flex justify-between">
                                <span>다음 예정일</span>
                                <span className="font-medium">
                                  {(() => {
                                    const dateString = scheduleItem.nextDueDate || scheduleItem.next_due_date;
                                    if (!dateString) return '-';
                                    try {
                                      const date = new Date(dateString);
                                      if (isNaN(date.getTime())) return '-';
                                      return format(date, 'yyyy-MM-dd', { locale: ko });
                                    } catch {
                                      return '-';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2 border-t">
                              {scheduleItem.status === 'active' ? (
                                <Button
                                  size="default"
                                  variant="outline"
                                  onClick={() => handlePauseSchedule(scheduleItem.id)}
                                  className={`flex-1 ${touchTarget.button}`}
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  일시중지
                                </Button>
                              ) : scheduleItem.status === 'paused' ? (
                                <Button
                                  size="default"
                                  variant="outline"
                                  onClick={() => handleResumeSchedule(scheduleItem)}
                                  className={`flex-1 ${touchTarget.button}`}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  재개
                                </Button>
                              ) : null}
                              <ScheduleEditModal
                                schedule={scheduleItem as any}
                                triggerButton={
                                  <Button
                                    size="default"
                                    variant="outline"
                                    aria-label="스케줄 수정"
                                    className={touchTarget.iconButton}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <Button
                                size="default"
                                variant="destructive"
                                aria-label="스케줄 삭제"
                                onClick={() => handleDeleteSchedule(scheduleItem.id)}
                                className={touchTarget.iconButton}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                        );
                      })}
                    </div>
                  ) : (
                    // Desktop: Table Layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>환자</TableHead>
                          <TableHead>검사/주사</TableHead>
                          <TableHead>주기</TableHead>
                          <TableHead>다음 예정일</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displaySchedules.map((scheduleItem, index) => {
                          // Generate guaranteed unique key
                          const uniqueKey = `schedule-row-${scheduleItem.id}-${index}`;
                          return (
                          <TableRow key={uniqueKey} className={getScheduleCardBgColor(scheduleItem.item?.category as ItemCategory)}>
                            <TableCell className="font-medium">
                              {scheduleItem.patient?.name || '환자 정보 없음'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const IconComponent = getScheduleCategoryIcon(scheduleItem.item?.category as ItemCategory);
                                  return IconComponent ? (
                                    <IconComponent className={`h-4 w-4 ${getScheduleCategoryColor(scheduleItem.item?.category as ItemCategory)}`} />
                                  ) : null;
                                })()}
                                <div>
                                  <div>{scheduleItem.item?.name || '항목 정보 없음'}</div>
                                  {scheduleItem.item?.category && (
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${getScheduleCategoryBgColor(scheduleItem.item?.category as ItemCategory)} ${getScheduleCategoryColor(scheduleItem.item?.category as ItemCategory)}`}>
                                      {getScheduleCategoryLabel(scheduleItem.item.category as ItemCategory)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {scheduleItem.intervalWeeks || scheduleItem.interval_weeks || 0}주
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const dateString = scheduleItem.nextDueDate || scheduleItem.next_due_date;
                                if (!dateString) return '-';
                                try {
                                  const date = new Date(dateString);
                                  if (isNaN(date.getTime())) return '-';
                                  return format(date, 'yyyy-MM-dd', { locale: ko });
                                } catch {
                                  return '-';
                                }
                              })()}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(scheduleItem)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {scheduleItem.status === 'active' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePauseSchedule(scheduleItem.id)}
                                  >
                                    일시중지
                                  </Button>
                                ) : scheduleItem.status === 'paused' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResumeSchedule(scheduleItem)}
                                  >
                                    재개
                                  </Button>
                                ) : null}
                                <ScheduleEditModal
                                  schedule={scheduleItem as any}
                                  triggerButton={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      aria-label="스케줄 수정"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  aria-label="스케줄 삭제"
                                  onClick={() => handleDeleteSchedule(scheduleItem.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resume Dialog */}
      {selectedScheduleForResume && (
        <ScheduleResumeDialog
          schedule={{
            id: selectedScheduleForResume.id,
            patientId: selectedScheduleForResume.patient?.id || '',
            itemId: selectedScheduleForResume.item?.id || '',
            intervalWeeks: selectedScheduleForResume.intervalWeeks,
            startDate: '',
            nextDueDate: selectedScheduleForResume.nextDueDate,
            status: selectedScheduleForResume.status,
            priority: 1,
            requiresNotification: false,
            notificationDaysBefore: 3,
            createdAt: selectedScheduleForResume.createdAt || '',
            updatedAt: selectedScheduleForResume.updatedAt || ''
          } as any}
          missedExecutions={0} // Calculate based on pause duration
          pauseDuration={
            selectedScheduleForResume.updatedAt
              ? differenceInWeeks(new Date(), new Date(selectedScheduleForResume.updatedAt))
              : 0
          }
          open={resumeDialogOpen}
          onConfirm={handleConfirmResume}
          onCancel={() => {
            setResumeDialogOpen(false);
            setSelectedScheduleForResume(null);
          }}
        />
      )}
    </div>
  );
}

export default function SchedulesPage() {
  const { data: profile } = useProfile();

  return (
    <FilterProvider persistToUrl={true}>
      <div className="space-y-4">
        {/* Show filter toggle for nurse and doctor */}
        {profile && (profile.role === 'nurse' || profile.role === 'doctor') && (
          <div className="p-3 bg-gray-50 border rounded-lg">
            <SimpleFilterToggle />
          </div>
        )}

        <SchedulesContent />
      </div>
    </FilterProvider>
  );
}