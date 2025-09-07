'use client'

import { useState } from 'react'
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
  const [currentValue, setCurrentValue] = useState<'외래' | '입원' | '낮병원' | null>(patient.careType)
  const { toast } = useToast()

  const handleChange = async (value: string) => {
    const newCareType = value as '외래' | '입원' | '낮병원'
    
    // 같은 값이면 무시
    if (newCareType === currentValue) {
      return
    }

    const previousValue = currentValue
    setCurrentValue(newCareType)
    setIsLoading(true)

    try {
      await patientService.update(patient.id, {
        careType: newCareType,
      })

      toast({
        title: '진료구분이 변경되었습니다',
        description: `${patient.name} 환자의 진료구분이 ${newCareType}(으)로 변경되었습니다.`,
      })

      onSuccess?.()
    } catch (error) {
      // 에러 시 이전 값으로 롤백
      setCurrentValue(previousValue)
      
      console.error('진료구분 변경 실패:', error)
      toast({
        title: '진료구분 변경 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
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
          <SelectItem value="외래">외래</SelectItem>
          <SelectItem value="입원">입원</SelectItem>
          <SelectItem value="낮병원">낮병원</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}