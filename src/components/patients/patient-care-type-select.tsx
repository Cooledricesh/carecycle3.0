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

// Type-safe care types
const CARE_TYPES = ['외래', '입원', '낮병원'] as const
type CareType = typeof CARE_TYPES[number]

const isValidCareType = (value: string): value is CareType => {
  return CARE_TYPES.includes(value as CareType)
}

interface PatientCareTypeSelectProps {
  patient: Patient
  onSuccess?: () => void
  compact?: boolean
}

export function PatientCareTypeSelect({ 
  patient, 
  onSuccess,
  compact = false 
}: PatientCareTypeSelectProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentValue, setCurrentValue] = useState<CareType | null>(patient.careType)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // Request ID to handle race conditions
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  
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
    // Type-safe validation
    if (!isValidCareType(value)) {
      console.error('Invalid care type received:', value)
      toast({
        title: '잘못된 진료구분',
        description: '올바른 진료구분을 선택해주세요.',
        variant: 'destructive',
      })
      return
    }
    
    const newCareType = value
    
    // 같은 값이면 무시
    if (newCareType === currentValue) {
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
    setCurrentValue(newCareType)
    setIsLoading(true)

    try {
      await patientService.update(patient.id, {
        careType: newCareType,
      })
      
      // Only process if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        toast({
          title: '진료구분이 변경되었습니다',
          description: `${patient.name} 환자의 진료구분이 ${newCareType}(으)로 변경되었습니다.`,
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

  return (
    <div className={`relative ${compact ? 'w-24' : 'w-28'}`}>
      <Select 
        value={currentValue || ''} 
        onValueChange={handleChange}
        disabled={isLoading}
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
          ) : (
            <SelectValue placeholder="-">
              {currentValue || '-'}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          {CARE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}