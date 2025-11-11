'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, touchTarget } from '@/lib/utils'
import type { Item, ItemInsert } from '@/lib/database.types'

interface ItemFormProps {
  item?: Item | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>) => void
  isMobile: boolean
  isSubmitting?: boolean
}

// 모바일용 멀티스텝 폼 스텝 정의
const formSteps = [
  { title: '기본 정보', fields: ['name', 'category'] },
  { title: '일정 설정', fields: ['default_interval_weeks', 'requires_notification', 'notification_days_before'] },
  { title: '추가 정보', fields: ['notes', 'is_active'] },
]

export function ItemForm({
  item,
  isOpen,
  onClose,
  onSubmit,
  isMobile,
  isSubmitting = false
}: ItemFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Partial<Omit<ItemInsert, 'code'>>>({
    name: '',
    category: 'injection',
    default_interval_weeks: 4,
    description: '',
    requires_notification: true,
    notification_days_before: 7,
    is_active: true,
  })

  // 아이템 수정 시 폼 데이터 초기화
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category,
        default_interval_weeks: item.default_interval_weeks || 4,
        description: item.description || '',
        requires_notification: item.requires_notification ?? true,
        notification_days_before: item.notification_days_before || 7,
        is_active: item.is_active ?? true,
      })
    } else {
      // 새 아이템 추가 시 폼 초기화
      setFormData({
        name: '',
        category: 'injection',
        default_interval_weeks: 4,
        description: '',
        requires_notification: true,
        notification_days_before: 7,
        is_active: true,
      })
      setCurrentStep(0)
    }
  }, [item, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData as Omit<ItemInsert, 'id' | 'created_at' | 'updated_at' | 'code'>)
  }

  const handleNextStep = () => {
    if (currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // 현재 스텝에 따른 폼 필드 렌더링
  const renderFormFields = () => {
    const currentFields = isMobile ? formSteps[currentStep].fields : null

    return (
      <div className={cn(
        "grid gap-4",
        !isMobile && "py-4"
      )}>
        {/* 기본 정보 */}
        {(!isMobile || currentFields?.includes('name')) && (
          <div className="space-y-2">
            <Label htmlFor="name">항목명 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 인베가 서스티나"
              required
              className={touchTarget.input}
            />
          </div>
        )}

        {(!isMobile || currentFields?.includes('category')) && (
          <div className="space-y-2">
            <Label htmlFor="category">카테고리 *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className={touchTarget.input}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="injection">주사</SelectItem>
                <SelectItem value="test">검사</SelectItem>
                <SelectItem value="other">기타</SelectItem>
              </SelectContent>
            </Select>

            {/* 주사 카테고리 선택 시 용량 안내 */}
            {formData.category === 'injection' && (
              <p className="text-sm text-muted-foreground mt-1">
                주사 용량은 일정 생성 시 개별 설정됩니다.
              </p>
            )}
          </div>
        )}

        {/* 일정 설정 */}
        {(!isMobile || currentFields?.includes('default_interval_weeks')) && (
          <div className="space-y-2">
            <Label htmlFor="interval">기본 주기 (주)</Label>
            <Input
              id="interval"
              type="number"
              value={formData.default_interval_weeks || ''}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setFormData({
                  ...formData,
                  default_interval_weeks: e.target.value === '' ? null : (Number.isNaN(parsed) ? null : parsed)
                });
              }}
              placeholder="4"
              className={touchTarget.input}
            />
          </div>
        )}

        {(!isMobile || currentFields?.includes('requires_notification')) && (
          <div className={cn(
            "space-y-4",
            !isMobile && "grid grid-cols-2 gap-4"
          )}>
            <div className="flex items-center space-x-2">
              <Switch
                id="notification"
                checked={formData.requires_notification ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requires_notification: checked })
                }
              />
              <Label htmlFor="notification">알림 설정</Label>
            </div>

            {formData.requires_notification && (
              <div className="space-y-2">
                <Label htmlFor="notification_days">알림 일수 (일 전)</Label>
                <Input
                  id="notification_days"
                  type="number"
                  value={formData.notification_days_before || ''}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setFormData({
                      ...formData,
                      notification_days_before: e.target.value === '' ? null : (Number.isNaN(parsed) ? null : parsed)
                    });
                  }}
                  placeholder="7"
                  className={touchTarget.input}
                />
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        {(!isMobile || currentFields?.includes('notes')) && (
          <div className="space-y-2">
            <Label htmlFor="notes">메모</Label>
            <Textarea
              id="notes"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="항목에 대한 메모나 특이사항을 입력하세요"
              rows={isMobile ? 3 : 3}
            />
          </div>
        )}

        {/* 활성 상태 */}
        {(!isMobile || currentFields?.includes('is_active')) && (
          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.is_active ?? true}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
            <Label htmlFor="active">활성 상태</Label>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-2xl",
        isMobile && "max-w-full h-full max-h-full rounded-none"
      )}>
        <DialogHeader>
          <DialogTitle>
            {item ? '항목 수정' : '새 항목 추가'}
          </DialogTitle>
          <DialogDescription>
            {item
              ? '항목 정보를 수정합니다.'
              : '새로운 검사/주사 항목을 추가합니다.'}
          </DialogDescription>
        </DialogHeader>

        {/* 모바일: 스텝 인디케이터 */}
        {isMobile && (
          <div className="flex justify-center gap-1 py-2">
            {formSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  index === currentStep ? "bg-blue-600 w-8" : "bg-gray-300"
                )}
              />
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 모바일: 스텝 제목 */}
          {isMobile && (
            <div className="text-center">
              <h3 className="text-lg font-medium">
                {formSteps[currentStep].title}
              </h3>
            </div>
          )}

          {/* 폼 필드 */}
          <div className={cn(
            isMobile && "flex-1 overflow-y-auto px-1"
          )}>
            {renderFormFields()}
          </div>

          <DialogFooter className={cn(
            isMobile && "flex-row justify-between gap-2"
          )}>
            {isMobile ? (
              <>
                {/* 모바일: 스텝 네비게이션 */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={currentStep === 0 ? onClose : handlePrevStep}
                  className={touchTarget.button}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {currentStep === 0 ? '취소' : '이전'}
                </Button>

                {currentStep === formSteps.length - 1 ? (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={touchTarget.button}
                  >
                    {item ? '수정' : '추가'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className={touchTarget.button}
                  >
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </>
            ) : (
              <>
                {/* 데스크톱: 일반 버튼 */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {item ? '수정' : '추가'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}