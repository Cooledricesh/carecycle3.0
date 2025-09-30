'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Edit, CalendarIcon } from 'lucide-react'
import { format, parse } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  ScheduleEditSchema, 
  type ScheduleEditInput 
} from '@/schemas/schedule'
import { scheduleService } from '@/services/scheduleService'
import { scheduleServiceEnhanced } from '@/services/scheduleServiceEnhanced'
import { eventManager } from '@/lib/events/schedule-event-manager'
import type { ScheduleWithDetails } from '@/types/schedule'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mapErrorToUserMessage } from '@/lib/error-mapper'

interface ScheduleEditModalProps {
  schedule: ScheduleWithDetails
  onSuccess?: () => void
  triggerButton?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ItemOption {
  id: string
  code: string
  name: string
  category: string
  defaultIntervalDays: number
}

export function ScheduleEditModal({
  schedule,
  onSuccess,
  triggerButton,
  open: controlledOpen,
  onOpenChange
}: ScheduleEditModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled && onOpenChange ? onOpenChange : setInternalOpen
  const [items, setItems] = useState<ItemOption[]>([])
  const [itemComboOpen, setItemComboOpen] = useState(false)
  const [itemSearchValue, setItemSearchValue] = useState('')
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const form = useForm<ScheduleEditInput>({
    resolver: zodResolver(ScheduleEditSchema),
    defaultValues: {
      itemName: schedule.item_name || '',
      intervalWeeks: schedule.interval_weeks || 1,
      nextDueDate: schedule.next_due_date || undefined,
      notes: schedule.notes || ''
    }
  })

  // Load items when modal opens
  useEffect(() => {
    if (open) {
      loadItems()
      // Reset form with current schedule data
      form.reset({
        itemName: schedule.item_name || '',
        intervalWeeks: schedule.interval_weeks || 1,
        nextDueDate: schedule.next_due_date || undefined,
        notes: schedule.notes || ''
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule, form])

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name')
      
      if (error) throw error
      
      const formattedItems: ItemOption[] = (data || []).map(item => ({
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

  const editMutation = useMutation({
    mutationFn: (data: ScheduleEditInput) => {
      console.log('[ScheduleEditModal] Calling editSchedule with:', {
        schedule_id: schedule.schedule_id,
        data,
        fullSchedule: schedule
      })
      return scheduleService.editSchedule(schedule.schedule_id, data)
    },
    onSuccess: () => {
      // scheduleServiceEnhanced의 캐시도 클리어하고 이벤트 발행
      scheduleServiceEnhanced.clearCache()
      eventManager.emitScheduleChange()

      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['overdueSchedules'] })
      toast({
        title: '성공',
        description: '스케줄이 수정되었습니다.',
      })
      form.reset()
      setOpen(false)
      if (onSuccess) {
        onSuccess()
      }
    },
    onError: (error) => {
      const message = mapErrorToUserMessage(error)
      toast({
        title: '오류',
        description: message,
        variant: 'destructive'
      })
    }
  })

  const handleItemSelect = (itemName: string) => {
    form.setValue('itemName', itemName)
    
    // 선택한 항목의 기본 주기 설정 (주 단위로 변환)
    const selectedItem = items.find(item => item.name === itemName)
    if (selectedItem) {
      const days = selectedItem.defaultIntervalDays
      // 모든 주기를 주 단위로 변환 (최소 1주)
      const weeks = Math.max(1, Math.round(days / 7))
      form.setValue('intervalWeeks', weeks)
    }
    
    setItemComboOpen(false)
  }

  const onSubmit = async (data: ScheduleEditInput) => {
    editMutation.mutate(data)
  }

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Edit className="h-4 w-4" />
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>스케줄 수정</DialogTitle>
          <DialogDescription>
            {schedule.patient_name}님의 스케줄을 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            {/* Interval Weeks */}
            <FormField
              control={form.control}
              name="intervalWeeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>반복 주기 (주) *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="52"
                        placeholder="1"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium">주</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    몇 주마다 반복할지 입력하세요 (1-52주)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Next Due Date */}
            <FormField
              control={form.control}
              name="nextDueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>다음 시행 예정일</FormLabel>
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
                            format(parse(field.value, 'yyyy-MM-dd', new Date()), "PPP", { locale: ko })
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
                        selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined}
                        onSelect={(date) => {
                          field.onChange(date ? format(date, 'yyyy-MM-dd') : undefined)
                          setDatePopoverOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    다음 검사/주사 시행 예정일을 변경할 수 있습니다.
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
                  <FormDescription>
                    최대 500자까지 입력 가능합니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={editMutation.isPending}
              >
                취소
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? '수정 중...' : '수정 완료'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}