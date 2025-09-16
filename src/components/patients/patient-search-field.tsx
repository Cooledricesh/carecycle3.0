'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Check, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { usePatientSearch } from '@/hooks/usePatientSearch'
import type { Patient } from '@/types/patient'

interface PatientSearchFieldProps {
  value?: string
  onChange?: (patientId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
  showPatientNumber?: boolean
}

export function PatientSearchField({
  value,
  onChange,
  placeholder = '환자 이름을 입력하여 검색하세요',
  disabled = false,
  className,
  required = false,
  showPatientNumber = true,
}: PatientSearchFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    searchQuery,
    selectedPatient,
    searchResults,
    isLoading,
    isSearchActive,
    hasResults,
    handleSearchChange,
    handleSelectPatient,
    clearSelection,
  } = usePatientSearch({
    onSelect: (patient) => {
      onChange?.(patient.id)
      setIsFocused(false)
    }
  })

  // Handle clear button
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearSelection()
    onChange?.('')
    inputRef.current?.focus()
  }

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const showDropdown = isFocused && searchQuery.length > 0

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.patientNumber})` : searchQuery}
          onChange={(e) => {
            if (selectedPatient) {
              clearSelection()
            }
            handleSearchChange(e.target.value)
          }}
          onFocus={() => {
            setIsFocused(true)
            if (selectedPatient) {
              clearSelection()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pl-9 pr-9",
            className
          )}
          required={required}
        />
        {(selectedPatient || searchQuery) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="max-h-[300px] overflow-y-auto py-1">
            {isLoading && isSearchActive && (
              <div className="flex items-center justify-center px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">검색 중...</span>
              </div>
            )}

            {!isLoading && isSearchActive && !hasResults && (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                "{searchQuery}"에 대한 검색 결과가 없습니다.
              </div>
            )}

            {!isSearchActive && searchQuery.length > 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                최소 2글자 이상 입력해주세요.
              </div>
            )}

            {!isLoading && hasResults && (
              <>
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      handleSelectPatient(patient)
                      setIsFocused(false)
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check
                      className={cn(
                        "mr-3 h-4 w-4",
                        selectedPatient?.id === patient.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start text-left">
                      <div className="font-medium">{patient.name}</div>
                      {showPatientNumber && (
                        <div className="text-xs text-muted-foreground">
                          {patient.patientNumber}
                          {patient.careType && ` · ${patient.careType}`}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}