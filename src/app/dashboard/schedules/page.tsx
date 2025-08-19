"use client";

import { useState } from "react";
import { Calendar, Clock, Plus, Filter, Search, Trash2, Edit, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCreateModal } from "@/components/schedules/schedule-create-modal";
import { useSchedules, useOverdueSchedules } from "@/hooks/useSchedules";
import { scheduleService } from "@/services/scheduleService";
import type { ScheduleWithDetails } from "@/types/schedule";
import { format } from "date-fns";
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

export default function SchedulesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { schedules, isLoading: schedulesLoading, error: schedulesError, refetch: refetchSchedules } = useSchedules();
  const { data: overdueSchedules = [], isLoading: overdueLoading, error: overdueError, refetch: refetchOverdue } = useOverdueSchedules();
  
  const loading = schedulesLoading || overdueLoading;
  const error = schedulesError || overdueError;
  
  const refetchAll = () => {
    refetchSchedules();
    refetchOverdue();
  };

  const deleteMutation = useMutation({
    mutationFn: scheduleService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['overdueSchedules'] });
      toast({
        title: "성공",
        description: "스케줄이 삭제되었습니다.",
      });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['overdueSchedules'] });
      toast({
        title: "성공",
        description: variables.status === 'paused' 
          ? "스케줄이 일시중지되었습니다."
          : "스케줄이 재개되었습니다.",
      });
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

  const handleResumeSchedule = (id: string) => {
    statusMutation.mutate({ id, status: 'active' });
  };

  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch = 
      schedule.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.item?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      selectedTab === "all" ||
      (selectedTab === "active" && schedule.status === 'active') ||
      (selectedTab === "paused" && schedule.status === 'paused') ||
      (selectedTab === "overdue" && overdueSchedules.some(o => o.id === schedule.id));
    
    return matchesSearch && matchesTab;
  });

  const displaySchedules = selectedTab === "overdue" ? overdueSchedules : filteredSchedules;

  const getStatusBadge = (schedule: ScheduleWithDetails) => {
    if (schedule.status === 'paused') {
      return <Badge variant="secondary">일시중지</Badge>;
    }
    if (schedule.status === 'completed') {
      return <Badge variant="outline">완료</Badge>;
    }
    if (overdueSchedules.some(o => o.id === schedule.id)) {
      return <Badge variant="destructive">지연</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">활성</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">스케줄 관리</h1>
          <p className="text-gray-500 mt-1">
            모든 환자의 반복 검사 및 주사 스케줄을 관리합니다
          </p>
        </div>
        <ScheduleCreateModal 
          onSuccess={refetchAll}
          triggerClassName="w-full sm:w-auto"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="환자명 또는 검사/주사명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            전체 ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            활성 ({schedules.filter(s => s.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            일시중지 ({schedules.filter(s => s.status === 'paused').length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            지연 ({overdueSchedules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>스케줄 목록</CardTitle>
              <CardDescription>
                {selectedTab === 'overdue' 
                  ? '오늘까지 처리해야 할 지연된 스케줄입니다.'
                  : '등록된 모든 스케줄을 확인하고 관리할 수 있습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>스케줄을 불러오는 중 오류가 발생했습니다.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refetchAll}
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
                    {displaySchedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">
                          {schedule.patient?.name || '환자 정보 없음'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{schedule.item?.name || '항목 정보 없음'}</div>
                            <div className="text-xs text-gray-500">
                              {schedule.item?.category}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {schedule.intervalDays}일
                        </TableCell>
                        <TableCell>
                          {format(new Date(schedule.nextDueDate), 'yyyy-MM-dd', { locale: ko })}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(schedule)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {schedule.status === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePauseSchedule(schedule.id)}
                              >
                                일시중지
                              </Button>
                            ) : schedule.status === 'paused' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResumeSchedule(schedule.id)}
                              >
                                재개
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}