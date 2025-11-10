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
import type { Patient } from '@/types/patient'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile, Profile } from '@/hooks/useProfile'
import { useDepartments } from '@/hooks/useDepartments'

interface PatientDepartmentSelectProps {
  patient: Patient
  onSuccess?: () => void
  compact?: boolean
}

export function PatientDepartmentSelect({
  patient,
  onSuccess,
  compact = false
}: PatientDepartmentSelectProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentValue, setCurrentValue] = useState<string | null>(patient.departmentId || null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined
  const { data: departments = [], isLoading: isDepartmentsLoading } = useDepartments()

  // Request ID to handle race conditions
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync local state with upstream changes (e.g., real-time updates, other users' changes)
  useEffect(() => {
    // Only sync when not loading to avoid overwriting user's pending changes
    if (!isLoading && patient.departmentId !== currentValue) {
      setCurrentValue(patient.departmentId ?? null)
    }
  }, [patient.departmentId, patient.id, isLoading, currentValue])

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
    const newDepartmentId = value

    // 같은 값이면 무시
    if (newDepartmentId === currentValue) {
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
    setCurrentValue(newDepartmentId)
    setIsLoading(true)

    try {
      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not found');
      }

      await patientService.update(
        patient.id,
        {
          departmentId: newDepartmentId,
        },
        typedProfile.organization_id,
        {
          signal: abortControllerRef.current.signal
        }
      )

      // Only process if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const departmentName = departments.find(d => d.id === newDepartmentId)?.name || '알 수 없음'
        toast({
          title: '진료구분이 변경되었습니다',
          description: `${patient.name} 환자의 진료구분이 ${departmentName}(으)로 변경되었습니다.`,
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
          console.error('진료구분 변경 실패:', error)
          toast({
            title: '진료구분 변경 실패',
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

  // Get current department name for display
  const currentDepartmentName = currentValue
    ? departments.find(d => d.id === currentValue)?.name
    : null

  return (
    <div className={`relative ${compact ? 'w-24' : 'w-28'}`}>
      <Select
        value={currentValue || ''}
        onValueChange={handleChange}
        disabled={isLoading || isDepartmentsLoading}
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
          ) : isDepartmentsLoading ? (
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">로딩...</span>
            </div>
          ) : (
            <SelectValue placeholder="-">
              {currentDepartmentName || '-'}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
