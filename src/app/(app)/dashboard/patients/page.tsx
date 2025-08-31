'use client'

import { useState, useMemo } from 'react'
import { PatientRegistrationModal } from '@/components/patients/patient-registration-modal'
import { PatientDeleteDialog } from '@/components/patients/patient-delete-dialog'
import { ScheduleCreateModal } from '@/components/schedules/schedule-create-modal'
import { usePatients } from '@/hooks/usePatients'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Users, Calendar, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function PatientsPage() {
  const { patients, isLoading, error, refetch, deletePatient, isDeleting } = usePatients()
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Pagination logic
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return patients.slice(startIndex, endIndex)
  }, [patients, currentPage, itemsPerPage])

  const totalPages = Math.ceil(patients.length / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const handleRegistrationSuccess = () => {
    refetch()
  }

  const handleScheduleSuccess = () => {
    refetch()
  }

  const handleDeletePatient = (id: string) => {
    deletePatient(id)
  }

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Invalidate all queries to get fresh data
      await queryClient.invalidateQueries()
      setLastUpdated(new Date())
      toast({
        title: "새로고침 완료",
        description: "최신 환자 데이터를 불러왔습니다.",
      })
    } catch (error) {
      toast({
        title: "새로고침 실패",
        description: "데이터를 새로고침하는 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">환자 관리</h1>
          <p className="text-muted-foreground mt-1">
            등록된 환자 목록을 관리하고 새로운 환자를 추가합니다.
            <span className="text-xs text-gray-400 ml-2">
              마지막 업데이트: {format(lastUpdated, 'HH:mm:ss')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <PatientRegistrationModal
            onSuccess={handleRegistrationSuccess}
            triggerClassName="bg-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            환자 목록
          </CardTitle>
          <CardDescription>
            총 {patients.length}명의 환자가 등록되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>환자 목록을 불러오는 중 오류가 발생했습니다.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="ml-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  다시 시도
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-lg mb-2">
                등록된 환자가 없습니다
              </p>
              <p className="text-sm text-muted-foreground">
                상단의 &quot;환자 등록&quot; 버튼을 클릭하여 첫 환자를 등록해보세요.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>환자번호</TableHead>
                    <TableHead>환자명</TableHead>
                    <TableHead>진료구분</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        {patient.patientNumber}
                      </TableCell>
                      <TableCell>{patient.name}</TableCell>
                      <TableCell>{patient.careType || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={patient.isActive ? 'default' : 'secondary'}>
                          {patient.isActive ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(patient.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ScheduleCreateModal
                            presetPatientId={patient.id}
                            onSuccess={handleScheduleSuccess}
                            triggerButton={
                              <Button variant="outline" size="sm">
                                <Calendar className="mr-2 h-4 w-4" />
                                스케줄 추가
                              </Button>
                            }
                          />
                          <PatientDeleteDialog
                            patientName={patient.name}
                            patientNumber={patient.patientNumber}
                            onConfirm={() => handleDeletePatient(patient.id)}
                            isDeleting={isDeleting}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {patients.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  표시 개수:
                </span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-4">
                  총 {patients.length}명 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, patients.length)}명 표시
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    {currentPage} / {totalPages} 페이지
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}