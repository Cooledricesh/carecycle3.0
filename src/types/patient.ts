'use client'

import { Database } from '@/lib/database.types'

// Base types from database
export type PatientRow = Database['public']['Tables']['patients']['Row']
export type PatientInsert = Database['public']['Tables']['patients']['Insert']
export type PatientUpdate = Database['public']['Tables']['patients']['Update']

// Application-level types (decrypted)
export interface Patient {
  id: string
  hospitalId?: string | null
  patientNumber: string
  name: string
  department?: string | null
  careType?: '외래' | '입원' | '낮병원' | null
  doctorId?: string | null
  doctorName?: string | null
  assignedDoctorName?: string | null  // For unregistered doctors
  isActive: boolean
  metadata?: Record<string, any>
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

// Secure view type
export interface PatientSecure {
  id: string
  hospitalId?: string | null
  patientNumber: string | null
  name: string | null
  department?: string | null
  careType?: '외래' | '입원' | '낮병원' | null
  isActive: boolean
  metadata?: Record<string, any>
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

// Form input types
export interface PatientCreateInput {
  patientNumber: string
  name: string
  department?: string | null
  careType?: '외래' | '입원' | '낮병원' | null
  doctorId?: string | null
  isActive?: boolean
  metadata?: Record<string, any>
}

export interface PatientUpdateInput {
  patientNumber?: string
  name?: string
  department?: string | null
  careType?: '외래' | '입원' | '낮병원' | null
  doctorId?: string | null
  assignedDoctorName?: string | null  // For unregistered doctors
  isActive?: boolean
  metadata?: Record<string, any>
}

// List/Filter types
export interface PatientFilter {
  department?: string
  careType?: '외래' | '입원' | '낮병원'
  isActive?: boolean
  searchTerm?: string
}

export interface PatientListItem {
  id: string
  patientNumber: string
  name: string
  department?: string | null
  careType?: '외래' | '입원' | '낮병원' | null
  doctorId?: string | null
  doctorName?: string | null
  isActive: boolean
  scheduleCount?: number
  lastExecutionDate?: string | null
}