"use client";

import { useState } from "react";
import { Calendar, Clock, Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Placeholder data - will be replaced with Supabase queries
const schedules = [
  {
    id: "1",
    patientName: "김철수",
    patientRoom: "301호",
    type: "injection",
    medication: "항생제 주사",
    time: "09:00",
    frequency: "매일",
    status: "active",
    startDate: "2024-01-15",
    endDate: "2024-01-22",
  },
  {
    id: "2",
    patientName: "이영희",
    patientRoom: "205호",
    type: "test",
    testName: "혈당 검사",
    time: "07:00",
    frequency: "주 3회 (월, 수, 금)",
    status: "active",
    startDate: "2024-01-10",
    endDate: "2024-02-10",
  },
  {
    id: "3",
    patientName: "박민수",
    patientRoom: "410호",
    type: "injection",
    medication: "인슐린",
    time: "08:00",
    frequency: "매일 3회",
    status: "completed",
    startDate: "2024-01-01",
    endDate: "2024-01-14",
  },
];

export default function SchedulesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch = 
      schedule.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.patientRoom.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      selectedTab === "all" ||
      (selectedTab === "active" && schedule.status === "active") ||
      (selectedTab === "completed" && schedule.status === "completed");
    
    return matchesSearch && matchesTab;
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "injection":
        return "주사";
      case "test":
        return "검사";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">진행중</Badge>;
      case "completed":
        return <Badge variant="secondary">완료</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">스케줄 관리</h1>
          <p className="text-gray-500 mt-1">
            반복 검사 및 주사 스케줄을 관리합니다
          </p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          새 스케줄 추가
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="환자명 또는 병실 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              필터
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs and Schedule List */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="active">진행중</TabsTrigger>
          <TabsTrigger value="completed">완료</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4 mt-6">
          {filteredSchedules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">
                  스케줄이 없습니다
                </h3>
                <p className="text-gray-500 mt-1">
                  새 스케줄을 추가하여 시작하세요
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSchedules.map((schedule) => (
                <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      {/* Left side - Patient info */}
                      <div className="space-y-3 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {schedule.patientName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {schedule.patientRoom}
                            </p>
                          </div>
                          {getStatusBadge(schedule.status)}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <Badge variant="outline" className="mr-2">
                              {getTypeLabel(schedule.type)}
                            </Badge>
                            <span className="font-medium">
                              {schedule.type === "injection" 
                                ? schedule.medication 
                                : schedule.testName}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {schedule.time}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="mr-1 h-3 w-3" />
                              {schedule.frequency}
                            </div>
                          </div>

                          <div className="text-xs text-gray-500">
                            {schedule.startDate} ~ {schedule.endDate}
                          </div>
                        </div>
                      </div>

                      {/* Right side - Actions */}
                      <div className="flex gap-2 sm:flex-col">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-initial">
                          수정
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-initial">
                          상세보기
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}