'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import {
  ScheduleCreateWithIntervalSchema,
  type ScheduleCreateWithIntervalInput
} from '@/schemas/schedule-create'
import { calculateNextDueDate, formatDateForDB } from '@/lib/date-utils'
import { scheduleService } from '@/services/scheduleService'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'
import { patientService } from '@/services/patientService'
import { PatientSearchField } from '@/components/patients/patient-search-field'
import type { Patient } from '@/types/patient'
import { useProfile, Profile } from '@/hooks/useProfile'
import { InjectionMetadataForm, type InjectionMetadata } from './InjectionMetadataForm'
import { Separator } from '@/components/ui/separator'

interface ScheduleCreateModalProps {
  presetPatientId?: string
  onSuccess?: () => void
  triggerButton?: React.ReactNode
  triggerClassName?: string
}

interface ItemOption {
  id: string
  code: string
  name: string
  category: string
  defaultIntervalDays: number
}

export function ScheduleCreateModal({
  presetPatientId,
  onSuccess,
  triggerButton,
  triggerClassName
}: ScheduleCreateModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [items, setItems] = useState<ItemOption[]>([])
  const [itemComboOpen, setItemComboOpen] = useState(false)
  const [itemSearchValue, setItemSearchValue] = useState('')
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [selectedItemCategory, setSelectedItemCategory] = useState<string | null>(null)
  const [injectionMetadata, setInjectionMetadata] = useState<InjectionMetadata | null>(null)
  const [showInjectionForm, setShowInjectionForm] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const { data: profile } = useProfile()
  const typedProfile = profile as Profile | null | undefined

  const form = useForm<ScheduleCreateWithIntervalInput>({
    resolver: zodResolver(ScheduleCreateWithIntervalSchema),
    defaultValues: {
      patientId: presetPatientId || '',
      itemName: '',
      intervalUnit: 'week',
      intervalValue: 1,
      firstPerformedAt: new Date(),
      notes: ''
    }
  })

  // Load items when modal opens
  useEffect(() => {
    if (open) {
      loadItems()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Set preset patient ID when modal opens
  useEffect(() => {
    if (presetPatientId && open) {
      form.setValue('patientId', presetPatientId)
    }
  }, [presetPatientId, open, form])

  const loadItems = async () => {
    if (!typedProfile?.organization_id) {
      console.error('Organization ID not found')
      return
    }

    try {
      const { data, error } = await (supabase as any)
          .from('items')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', typedProfile.organization_id)
        .order('sort_order')
        .order('name')

      if (error) throw error
      
      const formattedItems: ItemOption[] = (data || []).map((item: any) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        defaultIntervalDays: (item.default_interval_weeks || 0) * 7
      }))
      
      setItems(formattedItems)
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }

  const handleItemSelect = (itemName: string) => {
    form.setValue('itemName', itemName)
    
    // 선택한 항목의 기본 주기 설정 (주 단위로 변환)
    const selectedItem = items.find(item => item.name === itemName)
    if (selectedItem) {
      const days = selectedItem.defaultIntervalDays
      // 모든 주기를 주 단위로 변환 (최소 1주)
      const weeks = Math.max(1, Math.round(days / 7))
      form.setValue('intervalValue', weeks)
      form.setValue('intervalUnit', 'week')
    }
    
    setItemComboOpen(false)
  }

  const onSubmit = async (data: ScheduleCreateWithIntervalInput) => {
    try {
      setIsSubmitting(true)

      if (!typedProfile?.organization_id) {
        throw new Error('Organization ID not found');
      }

      // Verify patient exists
      const patientExists = await patientService.getById(data.patientId, typedProfile.organization_id)
      if (!patientExists) {
        throw new Error('선택한 환자를 찾을 수 없습니다.')
      }

      // For the first schedule, use the firstPerformedAt date as the first due date
      // Don't calculate the next cycle yet
      const firstDueDate = data.firstPerformedAt

      // Use weeks directly - no conversion needed
      const intervalWeeks = data.intervalValue

      // Find selected item to get its category
      const selectedItem = items.find(item => item.name === data.itemName)
      const category = selectedItem?.category as 'injection' | 'test' | 'other' | undefined

      // Create schedule
      await scheduleService.createWithCustomItem({
        patientId: data.patientId,
        itemName: data.itemName,
        intervalWeeks,
        intervalUnit: data.intervalUnit,
        intervalValue: data.intervalValue,
        startDate: formatDateForDB(data.firstPerformedAt),
        nextDueDate: formatDateForDB(firstDueDate), // Use first performed date as first due date
        notes: data.notes || null,
        category: category || 'other', // Use item's category or default to 'other'
        notificationDaysBefore: 7 // Default notification days
      }, typedProfile.organization_id)

      // Clear cache and emit event for real-time updates
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()

      toast({
        title: '성공',
        description: '스케줄이 추가되었습니다.',
      })

      // Reset form and close modal
      form.reset()
      setOpen(false)

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      let errorMessage = '스케줄 추가에 실패했습니다.'
      let errorTitle = '오류'

      if (error instanceof Error) {
        errorMessage = error.message

        // Check for duplicate schedule error (business validation)
        if (error.message.includes('이미 해당 환자의') && error.message.includes('스케줄이 활성 상태로 존재')) {
          errorTitle = '중복된 스케줄'
          // This is expected validation, not a system error
        } else if (error.message.includes('이미 동일한 스케줄이 존재')) {
          errorTitle = '중복된 스케줄'
        } else {
          // Only log unexpected errors
          console.error('Failed to create schedule:', error)
        }
      } else {
        // Log non-Error type exceptions
        console.error('Unexpected error type:', error)
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const defaultTrigger = (
    <Button className={triggerClassName}>
      <Plus className="mr-2 h-4 w-4" />
      스케줄 추가
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>새 스케줄 추가</DialogTitle>
          <DialogDescription>
            반복 검사 또는 주사 스케줄을 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Patient Selection - only show if not preset */}
            {!presetPatientId && (
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>환자 선택 *</FormLabel>
                    <FormControl>
                      <PatientSearchField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="환자 이름을 입력하여 검색하세요"
                        required
                        showPatientNumber
                      />
                    </FormControl>
                    <FormDescription>
                      환자 이름을 입력하여 검색할 수 있습니다. (2글자 이상)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Item Name with Autocomplete */}
            <FormField
              control={form.control}
              name="itemName"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>검사/주사명 *</FormLabel>
                  <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemComboOpen}
                          className="w-full justify-between font-normal"
                        >
                          {field.value || "검사/주사를 선택하거나 입력하세요"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="검색 또는 직접 입력..." 
                          value={itemSearchValue}
                          onValueChange={(value) => {
                            setItemSearchValue(value)
                            field.onChange(value)
                          }}
                        />
                        <CommandEmpty>
                          <div className="p-2 text-sm">
                            &ldquo;{itemSearchValue}&rdquo; 항목이 없습니다.
                            <br />
                            <span className="text-muted-foreground">
                              Enter를 눌러 새로 추가하세요.
                            </span>
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading="정신과 항목">
                          {items.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={() => handleItemSelect(item.name)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === item.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div>{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.category} · {Math.round(item.defaultIntervalDays / 7)}주 주기
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    기존 항목을 선택하거나 새로운 검사/주사명을 입력하세요.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Interval Settings - Only Weeks */}
            <FormField
              control={form.control}
              name="intervalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>반복 주기 (주) *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="1" 
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium">주</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    몇 주마다 반복할지 입력하세요 (예: 2주, 4주, 12주)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Hidden field for intervalUnit - always 'week' */}
            <input type="hidden" {...form.register('intervalUnit')} value="week" />

            {/* First Performed Date */}
            <FormField
              control={form.control}
              name="firstPerformedAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>최초 시행일 *</FormLabel>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ko })
                          ) : (
                            <span>날짜를 선택하세요</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                          setDatePopoverOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    첫 번째 검사/주사를 시행할 날짜를 선택하세요.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="추가 정보나 특이사항을 입력하세요"
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '추가 중...' : '스케줄 추가'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}