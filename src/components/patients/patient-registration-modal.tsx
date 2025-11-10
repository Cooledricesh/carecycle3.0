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
import { createClient } from '@/lib/supabase/client'
import { usePatientRestoration } from '@/hooks/usePatientRestoration'
import { PatientRestorationDialog } from './patient-restoration-dialog'
import { useDoctors } from '@/hooks/useDoctors'
import { useDepartments } from '@/hooks/useDepartments'
import { useProfile, Profile } from '@/hooks/useProfile'

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

  departmentId: z
    .string({
      required_error: '진료구분을 선택해주세요',
    }),

  doctorId: z
    .string()
    .optional()
    .nullable(),
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

  const restoration = usePatientRestoration()
  const { data: doctors, isLoading: isLoadingDoctors } = useDoctors()
  const { data: departments = [], isLoading: isLoadingDepartments } = useDepartments()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  // Get default department ID (외래)
  const defaultDepartmentId = departments.find(d => d.name === '외래')?.id || ''

  const form = useForm<PatientRegistrationFormData>({
    resolver: zodResolver(PatientRegistrationSchema),
    defaultValues: {
      name: '',
      patientNumber: '',
      departmentId: defaultDepartmentId,
      doctorId: null,
    },
  })

  const checkForConflictWithRestoration = async (patientNumber: string): Promise<{
    hasConflict: boolean
    canProceedWithRegistration: boolean
  }> => {
    try {
      console.log('[checkForConflictWithRestoration] Checking for restoration options:', patientNumber)
      
      const validationResult = await restoration.checkForConflict(patientNumber)
      console.log('[checkForConflictWithRestoration] Validation result:', validationResult)
      
      if (validationResult.isValid) {
        // No conflict, can proceed with normal registration
        return { hasConflict: false, canProceedWithRegistration: true }
      }

      // There's a conflict - check if it's restorable
      if (validationResult.conflictDetails?.canRestore || validationResult.conflictDetails?.canCreateNew) {
        // Show restoration dialog, don't proceed with normal registration yet
        return { hasConflict: true, canProceedWithRegistration: false }
      }

      // There's a conflict but no restoration options (active patient exists)
      return { hasConflict: true, canProceedWithRegistration: false }
    } catch (error) {
      console.error('[checkForConflictWithRestoration] Error:', error)
      return { hasConflict: true, canProceedWithRegistration: false }
    }
  }

  const onSubmit = async (data: PatientRegistrationFormData) => {
    console.log('Form submission started with data:', data)
    try {
      setIsSubmitting(true)

      // Check for conflicts and restoration options
      console.log('Checking for conflicts and restoration options...')
      const { hasConflict, canProceedWithRegistration } = await checkForConflictWithRestoration(data.patientNumber)
      console.log('Conflict check result:', { hasConflict, canProceedWithRegistration })
      
      if (hasConflict && !canProceedWithRegistration) {
        // If there's a restoration conflict, the dialog is already shown by the hook
        // Check if it's an active patient conflict (no restoration options)
        if (restoration.state.conflictDetails?.type === 'active_patient_exists') {
          form.setError('patientNumber', {
            type: 'manual',
            message: '이미 등록된 환자번호입니다',
          })
          toast({
            title: '등록 실패',
            description: '이미 존재하는 환자번호입니다. 다른 번호를 입력해주세요.',
            variant: 'destructive',
          })
        }
        // For restoration conflicts, the dialog handles the user interaction
        setIsSubmitting(false)
        return
      }

      // Create patient
      console.log('Creating patient with data:', {
        name: data.name,
        patientNumber: data.patientNumber,
        departmentId: data.departmentId,
        isActive: true,
      })

      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not found');
      }

      const supabase = createClient()
      const result = await patientService.create({
        name: data.name,
        patientNumber: data.patientNumber,
        departmentId: data.departmentId,
        doctorId: (typedProfile?.role === 'admin' || typedProfile?.role === 'doctor' || typedProfile?.role === 'nurse') ? data.doctorId : null,
        isActive: true,
      }, typedProfile.organization_id, supabase)
      
      console.log('Patient created successfully:', result)

      toast({
        title: '환자 등록 완료',
        description: `${data.name} 환자가 성공적으로 등록되었습니다.`,
      })

      // Reset form and close modal
      form.reset({
        name: '',
        patientNumber: '',
        departmentId: defaultDepartmentId,
        doctorId: null,
      })
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

  const handleRestorePatient = async () => {
    try {
      if (!restoration.state.inactivePatient) {
        throw new Error('복원할 환자 정보가 없습니다')
      }

      // Validate form before proceeding with restoration
      const isFormValid = await form.trigger()
      if (!isFormValid) {
        console.log('Form validation failed, aborting restoration')
        return
      }

      // Get validated form data only after successful validation
      const formData = form.getValues()
      await restoration.restorePatient(restoration.state.inactivePatient.id, {
        updateInfo: {
          name: formData.name,
          departmentId: formData.departmentId
        }
      })

      // Reset form and close modal only after successful restore
      form.reset({
        name: '',
        patientNumber: '',
        departmentId: defaultDepartmentId,
        doctorId: null,
      })
      setOpen(false)

      // Call success callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error restoring patient:', error)
      // Let form validation errors surface through form state
      // Only show generic error toast for non-validation errors
      if (error instanceof Error && !error.message.includes('validation')) {
        toast({
          title: '환자 복원 실패',
          description: error.message || '환자 복원 중 오류가 발생했습니다. 다시 시도해주세요.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleCreateNewPatient = async () => {
    try {
      // Trigger form validation before proceeding with creation
      const isFormValid = await form.trigger()
      if (!isFormValid) {
        console.log('Form validation failed, aborting patient creation')
        // Let form validation errors show in the form, don't proceed
        return
      }

      // Only proceed with form.getValues() and creation if validation passes
      const formData = form.getValues()

      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID가 없습니다')
      }

      await restoration.createWithArchive(formData.patientNumber, {
        name: formData.name,
        departmentId: formData.departmentId,
        organizationId: typedProfile.organization_id,
        metadata: {}
      })

      // Success branch: reset form, close modal, and call success callback
      form.reset({
        name: '',
        patientNumber: '',
        departmentId: defaultDepartmentId,
        doctorId: null,
      })
      setOpen(false)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error creating new patient:', error)
      // Let form validation errors surface through form state
      // Only show generic error toast for non-validation errors
      if (error instanceof Error && !error.message.includes('validation')) {
        toast({
          title: '환자 생성 실패',
          description: error.message || '환자 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleCancelRestoration = () => {
    restoration.clearConflict()
    setIsSubmitting(false)
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
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>진료구분 *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || isLoadingDepartments}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="진료구분을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(typedProfile?.role === 'admin' || typedProfile?.role === 'doctor' || typedProfile?.role === 'nurse') && (
              <FormField
                control={form.control}
                name="doctorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>주치의</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value || 'none'}
                      disabled={isSubmitting || isLoadingDoctors}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="주치의를 선택하세요 (선택사항)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">선택 안함</SelectItem>
                        {doctors?.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset({
                    name: '',
                    patientNumber: '',
                    departmentId: defaultDepartmentId,
                    doctorId: null,
                  })
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

      {/* Patient Restoration Dialog */}
      {restoration.hasConflict && restoration.state.conflictDetails && (
        <PatientRestorationDialog
          open={restoration.hasConflict}
          onOpenChange={(open) => {
            if (!open) {
              restoration.clearConflict()
            }
          }}
          conflictDetails={restoration.state.conflictDetails}
          inactivePatient={restoration.state.inactivePatient}
          isRestoring={restoration.state.isRestoring}
          isCreatingWithArchive={restoration.state.isCreatingWithArchive}
          onRestore={handleRestorePatient}
          onCreateNew={handleCreateNewPatient}
          onCancel={handleCancelRestoration}
        />
      )}
    </Dialog>
  )
}