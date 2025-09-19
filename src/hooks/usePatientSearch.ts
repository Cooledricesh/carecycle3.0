'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchPatients } from '@/hooks/usePatients'
import { useDebounce } from 'react-use'
import type { Patient } from '@/types/patient'

interface UsePatientSearchOptions {
  debounceMs?: number
  minQueryLength?: number
  onSelect?: (patient: Patient) => void
}

export function usePatientSearch(options: UsePatientSearchOptions = {}) {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    onSelect
  } = options

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  // Debounce the search query
  useDebounce(
    () => {
      setDebouncedQuery(searchQuery)
    },
    debounceMs,
    [searchQuery]
  )

  // Use the existing search hook with debounced query
  const { data: searchResults, isLoading, error } = useSearchPatients(debouncedQuery)

  // Handle patient selection
  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient)
    setSearchQuery(patient.name)
    setIsOpen(false)
    onSelect?.(patient)
  }, [onSelect])

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setSelectedPatient(null)

    // Always keep open while typing
    if (value.length > 0) {
      setIsOpen(true)
    }
  }, [])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPatient(null)
    setSearchQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
  }, [])

  // Check if search is active
  const isSearchActive = searchQuery.length >= minQueryLength

  return {
    // State
    searchQuery,
    selectedPatient,
    searchResults: searchResults || [],
    isLoading: isLoading && isSearchActive,
    error,
    isOpen,

    // Actions
    handleSearchChange,
    handleSelectPatient,
    clearSelection,
    setIsOpen,

    // Computed
    isSearchActive,
    hasResults: (searchResults?.length || 0) > 0,
    displayValue: selectedPatient
      ? `${selectedPatient.name} (${selectedPatient.patientNumber})`
      : searchQuery
  }
}