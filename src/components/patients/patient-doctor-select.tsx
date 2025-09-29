'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { patientService } from '@/services/patientService'
import { useDoctors } from '@/hooks/useDoctors'
import type { Patient } from '@/types/patient'
import { Loader2, UserCheck, Clock, UserPlus } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface PatientDoctorSelectProps {
  patient: Patient
  onSuccess?: () => void
  compact?: boolean
}

export function PatientDoctorSelect({
  patient,
  onSuccess,
  compact = false
}: PatientDoctorSelectProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentValue, setCurrentValue] = useState<string | null>(
    patient.doctorId || patient.assignedDoctorName || null
  )
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newDoctorName, setNewDoctorName] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: doctors, isLoading: isLoadingDoctors } = useDoctors()
  const supabase = createClient()

  // Fetch pending (unregistered) doctor names
  const { data: pendingDoctors } = useQuery({
    queryKey: ['pending-doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_pending_doctor_names')

      if (error) {
        console.error('Error fetching pending doctors:', error)
        return []
      }

      return data || []
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Request ID to handle race conditions
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync local state with upstream changes (e.g., real-time updates, other users' changes)
  useEffect(() => {
    // Only sync when not loading to avoid overwriting user's pending changes
    if (!isLoading) {
      const newValue = patient.doctorId || patient.assignedDoctorName || null
      if (newValue !== currentValue) {
        setCurrentValue(newValue)
      }
    }
  }, [patient.doctorId, patient.assignedDoctorName, patient.id, isLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleChange = async (value: string) => {
    // Special handling for "add new doctor" option
    if (value === 'add-new') {
      setShowAddDialog(true)
      return
    }

    // Parse the value to determine if it's a registered or pending doctor
    let newDoctorId: string | null = null
    let newDoctorName: string | null = null

    if (value === 'none') {
      // Unassigned
      newDoctorId = null
      newDoctorName = null
    } else if (value.startsWith('registered:')) {
      // Registered doctor
      newDoctorId = value.substring('registered:'.length)
      newDoctorName = null
    } else if (value.startsWith('pending:')) {
      // Pending (unregistered) doctor
      newDoctorId = null
      newDoctorName = value.substring('pending:'.length)
    }

    // Check if value actually changed
    if (newDoctorId === patient.doctorId && newDoctorName === patient.assignedDoctorName) {
      return
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new request ID and abort controller
    const currentRequestId = ++requestIdRef.current
    abortControllerRef.current = new AbortController()

    const previousValue = currentValue
    setCurrentValue(newDoctorId || newDoctorName || null)
    setIsLoading(true)

    try {
      await patientService.update(
        patient.id,
        {
          doctorId: newDoctorId,
          assignedDoctorName: newDoctorName,
        },
        {
          signal: abortControllerRef.current.signal
        }
      )

      // Only process if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        let doctorDisplayName = '미지정'
        if (newDoctorId) {
          doctorDisplayName = doctors?.find(d => d.id === newDoctorId)?.name || '미지정'
        } else if (newDoctorName) {
          doctorDisplayName = newDoctorName
        }

        toast({
          title: '주치의가 변경되었습니다',
          description: `${patient.name} 환자의 주치의가 ${doctorDisplayName}(으)로 변경되었습니다.`,
        })

        // Invalidate related queries for real-time sync
        queryClient.invalidateQueries({ queryKey: ['patients'] })
        queryClient.invalidateQueries({ queryKey: ['patients', patient.id] })
        queryClient.invalidateQueries({ queryKey: ['pending-doctors'] })

        onSuccess?.()
      }
    } catch (error) {
      // Only rollback if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        // 에러 시 이전 값으로 롤백
        setCurrentValue(previousValue)

        // Don't show error for aborted requests
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('주치의 변경 실패:', error)
          toast({
            title: '주치의 변경 실패',
            description: error.message || '알 수 없는 오류가 발생했습니다',
            variant: 'destructive',
          })
        }
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    }
  }

  const handleAddNewDoctor = async () => {
    const trimmedName = newDoctorName.trim()
    if (!trimmedName) {
      toast({
        title: '입력 오류',
        description: '의사 이름을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setShowAddDialog(false)
    setNewDoctorName('')

    // Trigger the change with the new doctor name
    await handleChange(`pending:${trimmedName}`)
  }

  // Get display value and determine current selection type
  let displayValue = '미지정'
  let selectValue = 'none'

  if (patient.doctorId) {
    const doctor = doctors?.find(d => d.id === patient.doctorId)
    if (doctor) {
      displayValue = doctor.name
      selectValue = `registered:${patient.doctorId}`
    }
  } else if (patient.assignedDoctorName) {
    displayValue = patient.assignedDoctorName
    selectValue = `pending:${patient.assignedDoctorName}`
  }

  return (
    <>
      <div className={`relative ${compact ? 'w-32' : 'w-36'}`}>
        <Select
          value={selectValue}
          onValueChange={handleChange}
          disabled={isLoading || isLoadingDoctors}
        >
          <SelectTrigger
            className={`
              ${compact ? 'h-7 text-xs' : 'h-8 text-sm'}
              ${isLoading ? 'opacity-50' : ''}
              border-gray-200 hover:border-gray-300
              focus:ring-1 focus:ring-blue-500
            `}
          >
            {isLoading ? (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">변경 중...</span>
              </div>
            ) : isLoadingDoctors ? (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">로딩 중...</span>
              </div>
            ) : (
              <SelectValue placeholder="미지정">
                <div className="flex items-center gap-1">
                  {patient.doctorId && (
                    <UserCheck className="h-3 w-3 text-green-600" />
                  )}
                  {!patient.doctorId && patient.assignedDoctorName && (
                    <Clock className="h-3 w-3 text-amber-600" />
                  )}
                  <span>{displayValue}</span>
                </div>
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">미지정</SelectItem>

            {/* Registered doctors */}
            {doctors && doctors.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-gray-500">등록된 의사</SelectLabel>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={`registered:${doctor.id}`}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>{doctor.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}

            {/* Pending doctors */}
            {pendingDoctors && pendingDoctors.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-gray-500">대기 중 (미등록)</SelectLabel>
                  {pendingDoctors.map((doctor: any) => (
                    <SelectItem key={doctor.name} value={`pending:${doctor.name}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-amber-600" />
                        <span>{doctor.name}</span>
                        <span className="text-xs text-gray-500">({doctor.patient_count}명)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}

            <SelectSeparator />
            <SelectItem value="add-new">
              <div className="flex items-center gap-2">
                <UserPlus className="h-3 w-3" />
                <span>새 의사 추가...</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add New Doctor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 의사 추가</DialogTitle>
            <DialogDescription>
              아직 등록되지 않은 의사의 이름을 입력하세요.
              나중에 해당 의사가 가입하면 자동으로 연결됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="doctor-name" className="text-right">
                의사 이름
              </Label>
              <Input
                id="doctor-name"
                value={newDoctorName}
                onChange={(e) => setNewDoctorName(e.target.value)}
                className="col-span-3"
                placeholder="예: 김철수"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewDoctor()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              취소
            </Button>
            <Button onClick={handleAddNewDoctor}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}