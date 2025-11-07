'use client'

import { useState, useMemo, useEffect } from 'react'
import { PatientRegistrationModal } from '@/components/patients/patient-registration-modal'
import { PatientDeleteDialog } from '@/components/patients/patient-delete-dialog'
import { PatientCareTypeSelect } from '@/components/patients/patient-care-type-select'
import { PatientDoctorSelect } from '@/components/patients/patient-doctor-select'
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
import { Input } from '@/components/ui/input'
import { Users, Calendar, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Search, MoreVertical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from '@/hooks/useIsMobile'
import { touchTarget, responsiveText, responsivePadding, responsiveSpacing } from '@/lib/utils'
import { FilterProvider } from '@/providers/filter-provider'
import { SimpleFilterToggle } from '@/components/filters/SimpleFilterToggle'
import { useProfile, Profile } from '@/hooks/useProfile'

interface PatientsContentProps {
  userRole?: string
}

function PatientsContent({ userRole }: PatientsContentProps) {
  const { patients, isLoading, error, refetch, deletePatient, isDeleting } = usePatients()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  // Initialize lastUpdated on client side only to avoid hydration mismatch
  useEffect(() => {
    setLastUpdated(new Date())
  }, [])

  // Filter patients based on search term
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) {
      return patients
    }

    const searchLower = searchTerm.toLowerCase()
    return patients.filter((patient) => {
      // Safely convert each field to string before calling toLowerCase/includes
      const name = String(patient.name ?? '').toLowerCase()
      const patientNumber = String(patient.patientNumber ?? '').toLowerCase()
      const careType = String(patient.careType ?? '').toLowerCase()
      const doctorName = String(patient.doctorName ?? '').toLowerCase()

      return (
        name.includes(searchLower) ||
        patientNumber.includes(searchLower) ||
        careType.includes(searchLower) ||
        doctorName.includes(searchLower)
      )
    })
  }, [patients, searchTerm])

  // Pagination logic - now using filtered patients
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredPatients.slice(startIndex, endIndex)
  }, [filteredPatients, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page when searching
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
    <div className={`container mx-auto ${responsivePadding.page}`}>
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4 sm:mb-6`}>
        <div>
          <h1 className={`${responsiveText.h1} font-bold tracking-tight`}>환자 관리</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">
            등록된 환자 목록을 관리하고 새로운 환자를 추가합니다.
            {lastUpdated && (
              <span className={`text-xs text-gray-400 ${isMobile ? 'block mt-1' : 'ml-2'}`}>
                마지막 업데이트: {format(lastUpdated, 'HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 ${isMobile ? 'flex-1' : ''} ${touchTarget.button}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <div className={isMobile ? 'flex-1' : ''}>
            <PatientRegistrationModal
              onSuccess={handleRegistrationSuccess}
              triggerClassName={`bg-primary ${isMobile ? 'w-full' : ''}`}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className={isMobile ? 'p-4' : ''}>
          <CardTitle className={`flex items-center gap-2 ${responsiveText.h3}`}>
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            환자 목록
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            총 {patients.length}명의 환자가 등록되어 있습니다.
            {searchTerm && filteredPatients.length !== patients.length && (
              <span className="ml-2 text-primary">
                (검색 결과: {filteredPatients.length}명)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10 pointer-events-none" />
              <Input
                placeholder={isMobile ? "검색..." : "환자명, 환자번호, 진료구분, 주치의로 검색..."}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`!pl-20 ${touchTarget.input}`}
              />
            </div>
          </div>
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
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-lg mb-2">
                {searchTerm ? '검색 결과가 없습니다' : '등록된 환자가 없습니다'}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 
                  '다른 검색어로 시도해보세요.' : 
                  '상단의 "환자 등록" 버튼을 클릭하여 첫 환자를 등록해보세요.'}
              </p>
            </div>
          ) : (
            <>
              {isMobile ? (
                // Mobile: Card Layout
                <div className={`space-y-3 ${responsiveSpacing.gap.sm}`}>
                  {paginatedPatients.map((patient) => (
                    <Card key={patient.id} className={`${responsivePadding.card} hover:shadow-md transition-shadow`}>
                      <div className="space-y-4">
                        {/* Patient Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <h4 className={`${responsiveText.h4} font-medium`}>{patient.name}</h4>
                            <p className={`${responsiveText.small} text-muted-foreground`}>#{patient.patientNumber}</p>
                          </div>
                        </div>
                        
                        {/* Patient Details */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`${responsiveText.small} text-muted-foreground`}>진료구분</span>
                            <PatientCareTypeSelect
                              patient={patient}
                              onSuccess={() => refetch()}
                              compact={true}
                            />
                          </div>
                          {(userRole === 'admin' || userRole === 'doctor' || userRole === 'nurse') && (
                            <div className="flex justify-between items-center">
                              <span className={`${responsiveText.small} text-muted-foreground`}>주치의</span>
                              <PatientDoctorSelect
                                patient={patient}
                                onSuccess={() => refetch()}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className={`flex ${responsiveSpacing.gap.sm} pt-3 border-t border-border`}>
                          <ScheduleCreateModal
                            presetPatientId={patient.id}
                            onSuccess={handleScheduleSuccess}
                            triggerButton={
                              <Button variant="outline" size="default" className={`flex-1 ${touchTarget.button}`}>
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
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // Desktop: Table Layout
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>환자번호</TableHead>
                        <TableHead>환자명</TableHead>
                        <TableHead>진료구분</TableHead>
                        {(userRole === 'admin' || userRole === 'doctor' || userRole === 'nurse') && <TableHead>주치의</TableHead>}
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
                          <TableCell>
                            <PatientCareTypeSelect
                              patient={patient}
                              onSuccess={() => refetch()}
                            />
                          </TableCell>
                          {(userRole === 'admin' || userRole === 'doctor' || userRole === 'nurse') && (
                            <TableCell>
                              <PatientDoctorSelect
                                patient={patient}
                                onSuccess={() => refetch()}
                              />
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <ScheduleCreateModal
                                presetPatientId={patient.id}
                                onSuccess={handleScheduleSuccess}
                                triggerButton={
                                  <Button variant="outline" size="sm" className={touchTarget.button}>
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
            </>
          )}
          
          {/* Pagination Controls */}
          {filteredPatients.length > 0 && (
            <div className={`${isMobile ? 'flex-col space-y-3' : 'flex items-center justify-between'} mt-4`}>
              <div className={`flex items-center gap-2 ${isMobile ? 'justify-center' : ''}`}>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  표시 개수:
                </span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className={`w-20 ${touchTarget.input}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                {!isMobile && (
                  <span className="text-sm text-muted-foreground ml-4">
                    총 {filteredPatients.length}명 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredPatients.length)}명 표시
                  </span>
                )}
              </div>
              
              {isMobile && (
                <div className="text-center text-xs text-muted-foreground">
                  총 {filteredPatients.length}명 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredPatients.length)}명 표시
                </div>
              )}
              
              <div className={`flex items-center gap-2 ${isMobile ? 'justify-center' : ''}`}>
                <Button
                  aria-label="이전 페이지"
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={touchTarget.button}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {!isMobile && '이전'}
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm">
                    {currentPage} / {totalPages} 페이지
                  </span>
                </div>
                <Button
                  aria-label="다음 페이지"
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={touchTarget.button}
                >
                  {!isMobile && '다음'}
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

export default function PatientsPage() {
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  return (
    <FilterProvider persistToUrl={true}>
      <div className="space-y-4">
        {/* Show filter toggle for nurse and doctor */}
        {typedProfile && (typedProfile.role === 'nurse' || typedProfile.role === 'doctor') && (
          <div className="p-3 bg-gray-50 border rounded-lg">
            <SimpleFilterToggle />
          </div>
        )}

        <PatientsContent userRole={typedProfile?.role} />
      </div>
    </FilterProvider>
  )
}