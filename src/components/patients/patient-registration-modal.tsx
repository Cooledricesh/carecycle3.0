'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { patientService } from '@/services/patientService'
import { useToast } from '@/hooks/use-toast'
import { getSupabaseClient } from '@/lib/supabase/singleton'

const PatientRegistrationSchema = z.object({
  name: z
    .string()
    .min(1, '환자명을 입력해주세요')
    .max(100, '환자명은 100자 이내로 입력해주세요')
    .regex(/^[가-힣a-zA-Z\s]+$/, '환자명은 한글, 영문, 공백만 입력 가능합니다'),
  
  patientNumber: z
    .string()
    .min(1, '환자번호를 입력해주세요')
    .max(50, '환자번호는 50자 이내로 입력해주세요')
    .regex(/^[A-Z0-9]+$/, '환자번호는 영문 대문자와 숫자만 입력 가능합니다'),
  
  careType: z
    .enum(['외래', '입원', '낮병원'], {
      required_error: '진료구분을 선택해주세요',
    }),
})

type PatientRegistrationFormData = z.infer<typeof PatientRegistrationSchema>

interface PatientRegistrationModalProps {
  onSuccess?: () => void
  triggerLabel?: string
  triggerClassName?: string
}

export function PatientRegistrationModal({
  onSuccess,
  triggerLabel = '환자 등록',
  triggerClassName = ''
}: PatientRegistrationModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<PatientRegistrationFormData>({
    resolver: zodResolver(PatientRegistrationSchema),
    defaultValues: {
      name: '',
      patientNumber: '',
      careType: '외래',
    },
  })

  const checkDuplicatePatientNumber = async (patientNumber: string): Promise<boolean> => {
    try {
      console.log('[checkDuplicatePatientNumber] Checking for:', patientNumber)
      
      // Use the new getByPatientNumber function
      const supabase = getSupabaseClient()
      const existingPatient = await patientService.getByPatientNumber(patientNumber, supabase)
      console.log('[checkDuplicatePatientNumber] Result:', existingPatient)
      
      return existingPatient !== null
    } catch (error) {
      console.error('Error checking duplicate patient number:', error)
      return false
    }
  }

  const onSubmit = async (data: PatientRegistrationFormData) => {
    console.log('Form submission started with data:', data)
    try {
      setIsSubmitting(true)

      // Check for duplicate patient number
      console.log('Checking for duplicate patient number...')
      const isDuplicate = await checkDuplicatePatientNumber(data.patientNumber)
      console.log('Duplicate check result:', isDuplicate)
      
      if (isDuplicate) {
        form.setError('patientNumber', {
          type: 'manual',
          message: '이미 등록된 환자번호입니다',
        })
        toast({
          title: '등록 실패',
          description: '이미 존재하는 환자번호입니다. 다른 번호를 입력해주세요.',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // Create patient
      console.log('Creating patient with data:', {
        name: data.name,
        patientNumber: data.patientNumber,
        careType: data.careType,
        isActive: true,
      })
      
      const supabase = getSupabaseClient()
      const result = await patientService.create({
        name: data.name,
        patientNumber: data.patientNumber,
        careType: data.careType,
        isActive: true,
      }, supabase)
      
      console.log('Patient created successfully:', result)

      toast({
        title: '환자 등록 완료',
        description: `${data.name} 환자가 성공적으로 등록되었습니다.`,
      })

      // Reset form and close modal
      form.reset()
      setOpen(false)

      // Call success callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Patient registration error - Full details:', error)
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      toast({
        title: '등록 실패',
        description: error instanceof Error ? error.message : '환자 등록 중 오류가 발생했습니다. 다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      console.log('Setting isSubmitting to false')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Plus className="w-4 h-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>신규 환자 등록</DialogTitle>
          <DialogDescription>
            환자의 기본 정보를 입력하여 시스템에 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>환자명 *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="홍길동"
                      disabled={isSubmitting}
                      aria-label="환자명 입력"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="patientNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>환자번호 *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="P123456"
                      disabled={isSubmitting}
                      aria-label="환자번호 입력"
                      onChange={(e) => {
                        // Convert to uppercase automatically
                        const value = e.target.value.toUpperCase()
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="careType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>진료구분 *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="진료구분을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="외래">외래</SelectItem>
                      <SelectItem value="입원">입원</SelectItem>
                      <SelectItem value="낮병원">낮병원</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset()
                  setOpen(false)
                }}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '등록 중...' : '등록'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}