'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/useIsMobile'
import { touchTarget } from '@/lib/utils'

export interface InjectionMetadata {
  dosage?: string
  route?: 'IV' | 'IM' | 'SC'
  notes?: string
}

// Validation schema for injection metadata
const InjectionMetadataSchema = z.object({
  dosage: z.string()
    .max(50, '용량은 50자를 초과할 수 없습니다')
    .regex(/^[\d.]+\s*(mg|ml|cc|g|L|mL|mcg|units?|IU)?$/i, '올바른 용량 형식을 입력하세요 (예: 10mg, 5ml)')
    .optional()
    .or(z.literal('')),
  route: z.enum(['IV', 'IM', 'SC']).optional().or(z.literal('')),
  notes: z.string()
    .max(500, '메모는 500자를 초과할 수 없습니다')
    .optional()
    .or(z.literal(''))
})

interface InjectionMetadataFormProps {
  onSubmit: (metadata: InjectionMetadata) => void
  onCancel: () => void
  isSubmitting?: boolean
}

/**
 * Form component for inputting injection metadata (dosage, route, notes).
 * Displayed when completing injection category schedules.
 *
 * Usage:
 * <InjectionMetadataForm
 *   onSubmit={(metadata) => console.log(metadata)}
 *   onCancel={() => setShowForm(false)}
 *   isSubmitting={false}
 * />
 */
export function InjectionMetadataForm({
  onSubmit,
  onCancel,
  isSubmitting = false
}: InjectionMetadataFormProps) {
  const isMobile = useIsMobile()
  const [dosage, setDosage] = useState('')
  const [route, setRoute] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setErrors({})

    // Validate with Zod
    const result = InjectionMetadataSchema.safeParse({
      dosage: dosage || '',
      route: route || '',
      notes: notes || ''
    })

    if (!result.success) {
      // Extract errors
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    // Submit validated data
    onSubmit({
      dosage: dosage || undefined,
      route: (route as 'IV' | 'IM' | 'SC') || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ARIA Live Region for screen readers */}
      <div role="alert" aria-live="polite" className="sr-only">
        {Object.values(errors).join('. ')}
      </div>

      {/* Dosage Input */}
      <div className="grid gap-2">
        <Label htmlFor="dosage" className="text-sm font-medium">
          용량
        </Label>
        <Input
          id="dosage"
          type="text"
          placeholder="예: 10mg, 5ml"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          className={`${touchTarget.input} ${errors.dosage ? 'border-red-500' : ''}`}
          disabled={isSubmitting}
          aria-label="주사 용량 입력"
          aria-invalid={!!errors.dosage}
          aria-describedby={errors.dosage ? 'dosage-error' : 'dosage-help'}
        />
        {errors.dosage ? (
          <p id="dosage-error" className="text-xs text-red-600">
            {errors.dosage}
          </p>
        ) : (
          <p id="dosage-help" className="text-xs text-gray-500">
            숫자와 단위를 함께 입력하세요 (예: 10mg, 5ml)
          </p>
        )}
      </div>

      {/* Route Selection */}
      <div className="grid gap-2">
        <Label htmlFor="route" className="text-sm font-medium">
          주사 경로
        </Label>
        <Select
          value={route}
          onValueChange={setRoute}
          disabled={isSubmitting}
        >
          <SelectTrigger
            id="route"
            className={touchTarget.input}
            aria-label="주사 경로 선택"
          >
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IV">정맥주사 (IV)</SelectItem>
            <SelectItem value="IM">근육주사 (IM)</SelectItem>
            <SelectItem value="SC">피하주사 (SC)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          주사 투여 경로를 선택하세요
        </p>
      </div>

      {/* Notes Textarea */}
      <div className="grid gap-2">
        <Label htmlFor="injection-notes" className="text-sm font-medium">
          메모 <span className="text-gray-400 font-normal">(선택사항)</span>
        </Label>
        <Textarea
          id="injection-notes"
          placeholder="추가 사항을 입력하세요 (예: 환자 반응, 특이사항 등)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={errors.notes ? 'border-red-500' : ''}
          disabled={isSubmitting}
          aria-label="주사 관련 메모"
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? 'notes-error' : undefined}
        />
        {errors.notes && (
          <p id="notes-error" className="text-xs text-red-600">
            {errors.notes}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'justify-end'}`}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
          aria-label="취소"
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
          aria-label="저장"
        >
          {isSubmitting ? '저장 중...' : '저장'}
        </Button>
      </div>
    </form>
  )
}
