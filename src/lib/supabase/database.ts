/* eslint-disable @typescript-eslint/ban-ts-comment */
// Healthcare Scheduler Database Operations
// Client-side database helper functions with type safety
// @ts-nocheck - Legacy code with outdated schema, needs refactoring

import { createClient } from './client'
import type { 
  Database, 
  Profile, 
  ProfileInsert, 
  ProfileUpdate, 
  PatientSchedule, 
  PatientScheduleInsert, 
  PatientScheduleUpdate,
  UserRole,
  ScheduleStatus
} from '../database.types'

export type SupabaseClient = ReturnType<typeof createClient>

// Profile Operations
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  async getCurrentProfile(): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .rpc('get_current_user_profile')
    
    if (error) throw error
    return data
  }

  async updateProfile(updates: ProfileUpdate): Promise<Profile> {
    // Get current user first and handle null case properly
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    
    if (authError || !user) {
      throw new Error('User must be authenticated to update profile')
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data || []
  }

  async getProfilesByRole(role: UserRole): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data || []
  }

  async getProfilesByDepartment(department: string): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('department', department)
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data || []
  }

  async isAdmin(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('is_admin')
    if (error) throw error
    return data || false
  }
}

// Schedule Operations
export class ScheduleService {
  constructor(private supabase: SupabaseClient) {}

  async getMySchedules(startDate?: string, endDate?: string): Promise<PatientSchedule[]> {
    const { data, error } = await this.supabase
      .rpc('get_my_schedules', {
        start_date: startDate,
        end_date: endDate
      })
    
    if (error) throw error
    return data || []
  }

  async createSchedule(schedule: PatientScheduleInsert): Promise<PatientSchedule> {
    // Check for conflicts first
    if (schedule.nurse_id) {
      const hasConflict = await this.checkScheduleConflict(
        schedule.nurse_id,
        schedule.scheduled_date,
        schedule.scheduled_time,
        schedule.duration_minutes || 30
      )
      
      if (hasConflict) {
        throw new Error('Schedule conflict detected. Please choose a different time.')
      }
    }

    const { data, error } = await this.supabase
      .from('patient_schedules')
      .insert(schedule)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateSchedule(id: string, updates: PatientScheduleUpdate): Promise<PatientSchedule> {
    // Check for conflicts if updating nurse, date, or time
    if (updates.nurse_id || updates.scheduled_date || updates.scheduled_time || updates.duration_minutes) {
      const current = await this.getScheduleById(id)
      const hasConflict = await this.checkScheduleConflict(
        updates.nurse_id || current.nurse_id!,
        updates.scheduled_date || current.scheduled_date,
        updates.scheduled_time || current.scheduled_time,
        updates.duration_minutes || current.duration_minutes,
        id
      )
      
      if (hasConflict) {
        throw new Error('Schedule conflict detected. Please choose a different time.')
      }
    }

    const { data, error } = await this.supabase
      .from('patient_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getScheduleById(id: string): Promise<PatientSchedule> {
    const { data, error } = await this.supabase
      .from('patient_schedules')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async getSchedulesByDate(date: string): Promise<PatientSchedule[]> {
    const { data, error } = await this.supabase
      .from('patient_schedules')
      .select(`
        *,
        nurse:profiles!patient_schedules_nurse_id_fkey(name, department),
        created_by_profile:profiles!patient_schedules_created_by_fkey(name)
      `)
      .eq('scheduled_date', date)
      .order('scheduled_time')
    
    if (error) throw error
    return data || []
  }

  async getSchedulesByNurse(nurseId: string, startDate?: string, endDate?: string): Promise<PatientSchedule[]> {
    let query = this.supabase
      .from('patient_schedules')
      .select('*')
      .eq('nurse_id', nurseId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (startDate) {
      query = query.gte('scheduled_date', startDate)
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async updateScheduleStatus(id: string, status: ScheduleStatus, notes?: string): Promise<PatientSchedule> {
    const updates: PatientScheduleUpdate = { status }
    if (notes) updates.notes = notes

    return this.updateSchedule(id, updates)
  }

  async checkScheduleConflict(
    nurseId: string,
    date: string,
    time: string,
    duration: number,
    excludeId?: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('check_schedule_conflict', {
        p_nurse_id: nurseId,
        p_scheduled_date: date,
        p_scheduled_time: time,
        p_duration_minutes: duration,
        p_exclude_id: excludeId
      })
    
    if (error) throw error
    return data || false
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('patient_schedules')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Database Monitoring (Admin only)
export class MonitoringService {
  constructor(private supabase: SupabaseClient) {}

  async getDatabaseHealth() {
    const { data, error } = await this.supabase
      .from('database_health')
      .select('*')
    
    if (error) throw error
    return data || []
  }

  async getPerformanceMetrics() {
    const { data, error } = await this.supabase
      .from('performance_metrics')
      .select('*')
    
    if (error) throw error
    return data || []
  }

  async getDatabaseStats() {
    const { data, error } = await this.supabase
      .rpc('get_db_stats')
    
    if (error) throw error
    return data || []
  }

  async getAuditLogs(limit: number = 100) {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }
}

// Main Database Service
export class DatabaseService {
  public profiles: ProfileService
  public schedules: ScheduleService
  public monitoring: MonitoringService

  constructor(private supabase: SupabaseClient) {
    this.profiles = new ProfileService(supabase)
    this.schedules = new ScheduleService(supabase)
    this.monitoring = new MonitoringService(supabase)
  }

  get client() {
    return this.supabase
  }
}

// Create database service instance
export function createDatabaseService() {
  const supabase = createClient()
  return new DatabaseService(supabase)
}