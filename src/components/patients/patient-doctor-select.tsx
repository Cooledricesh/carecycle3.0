'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { patientService } from '@/services/patientService'
import { useDoctors } from '@/hooks/useDoctors'
import type { Patient } from '@/types/patient'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

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
  const [currentValue, setCurrentValue] = useState<string | null>(patient.doctorId)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: doctors, isLoading: isLoadingDoctors } = useDoctors()

  // Request ID to handle race conditions
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync local state with upstream changes (e.g., real-time updates, other users' changes)
  useEffect(() => {
    // Only sync when not loading to avoid overwriting user's pending changes
    if (!isLoading && patient.doctorId !== currentValue) {
      setCurrentValue(patient.doctorId ?? null)
    }
  }, [patient.doctorId, patient.id, isLoading, currentValue])

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
    const newDoctorId = value === 'none' ? null : value

    // 같은 값이면 무시
    if (newDoctorId === currentValue) {
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
    setCurrentValue(newDoctorId)
    setIsLoading(true)

    try {
      await patientService.update(
        patient.id,
        {
          doctorId: newDoctorId,
        },
        {
          signal: abortControllerRef.current.signal
        }
      )

      // Only process if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const doctorName = newDoctorId ?
          doctors?.find(d => d.id === newDoctorId)?.name : null

        toast({
          title: '주치의가 변경되었습니다',
          description: `${patient.name} 환자의 주치의가 ${doctorName ? doctorName : '미지정'}로 변경되었습니다.`,
        })

        // Invalidate related queries for real-time sync
        queryClient.invalidateQueries({ queryKey: ['patients'] })
        queryClient.invalidateQueries({ queryKey: ['patients', patient.id] })

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

  // Get display value
  const displayValue = currentValue ?
    doctors?.find(d => d.id === currentValue)?.name : null

  return (
    <div className={`relative ${compact ? 'w-32' : 'w-36'}`}>
      <Select
        value={currentValue || 'none'}
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
              {displayValue || '미지정'}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">미지정</SelectItem>
          {doctors?.map((doctor) => (
            <SelectItem key={doctor.id} value={doctor.id}>
              {doctor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}