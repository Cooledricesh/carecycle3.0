// Healthcare Scheduler Database Types
// Auto-generated TypeScript types for Supabase database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'nurse' | 'admin'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type ExecutionStatus = 'planned' | 'completed' | 'skipped' | 'overdue'

export type ItemCategory = 'injection' | 'test' | 'treatment' | 'medication' | 'other'

export type AppointmentType = 'consultation' | 'treatment' | 'follow_up' | 'emergency' | 'routine_check'

export type NotificationChannel = 'dashboard' | 'push' | 'email'

export type NotificationState = 'pending' | 'ready' | 'sent' | 'failed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          role: UserRole
          department: string | null
          phone: string | null
          is_active: boolean
          approval_status: ApprovalStatus
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: UserRole
          department?: string | null
          phone?: string | null
          is_active?: boolean
          approval_status?: ApprovalStatus
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: UserRole
          department?: string | null
          phone?: string | null
          is_active?: boolean
          approval_status?: ApprovalStatus
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      patient_schedules: {
        Row: {
          id: string
          patient_name: string
          patient_phone: string | null
          patient_email: string | null
          nurse_id: string | null
          appointment_type: AppointmentType
          scheduled_date: string
          scheduled_time: string
          duration_minutes: number
          status: ScheduleStatus
          notes: string | null
          department: string | null
          room_number: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_name: string
          patient_phone?: string | null
          patient_email?: string | null
          nurse_id?: string | null
          appointment_type?: AppointmentType
          scheduled_date: string
          scheduled_time: string
          duration_minutes?: number
          status?: ScheduleStatus
          notes?: string | null
          department?: string | null
          room_number?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_name?: string
          patient_phone?: string | null
          patient_email?: string | null
          nurse_id?: string | null
          appointment_type?: AppointmentType
          scheduled_date?: string
          scheduled_time?: string
          duration_minutes?: number
          status?: ScheduleStatus
          notes?: string | null
          department?: string | null
          room_number?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          operation: string
          record_id: string | null
          old_values: Json | null
          new_values: Json | null
          user_id: string | null
          user_email: string | null
          user_role: string | null
          timestamp: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          table_name: string
          operation: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          user_email?: string | null
          user_role?: string | null
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          table_name?: string
          operation?: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          user_email?: string | null
          user_role?: string | null
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
        }
      }
      items: {
        Row: {
          id: string
          code: string
          name: string
          category: string
          default_interval_weeks: number | null
          description: string | null
          instructions: string | null
          preparation_notes: string | null
          requires_notification: boolean | null
          notification_days_before: number | null
          is_active: boolean | null
          sort_order: number | null
          metadata: any | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          code?: string
          name: string
          category: string
          default_interval_weeks?: number | null
          description?: string | null
          instructions?: string | null
          preparation_notes?: string | null
          requires_notification?: boolean | null
          notification_days_before?: number | null
          is_active?: boolean | null
          sort_order?: number | null
          metadata?: any | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          category?: string
          default_interval_weeks?: number | null
          description?: string | null
          instructions?: string | null
          preparation_notes?: string | null
          requires_notification?: boolean | null
          notification_days_before?: number | null
          is_active?: boolean | null
          sort_order?: number | null
          metadata?: any | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      patients: {
        Row: {
          id: string
          hospital_id: string | null
          patient_number: string
          name: string
          department: string | null
          care_type: string | null
          is_active: boolean
          archived: boolean
          archived_at: string | null
          original_patient_number: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hospital_id?: string | null
          patient_number: string
          name: string
          department?: string | null
          care_type?: string | null
          is_active?: boolean
          archived?: boolean
          archived_at?: string | null
          original_patient_number?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hospital_id?: string | null
          patient_number?: string
          name?: string
          department?: string | null
          care_type?: string | null
          is_active?: boolean
          archived?: boolean
          archived_at?: string | null
          original_patient_number?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          patient_id: string
          item_id: string
          interval_weeks: number
          start_date: string
          end_date: string | null
          last_executed_date: string | null
          next_due_date: string
          status: ScheduleStatus
          assigned_nurse_id: string | null
          notes: string | null
          priority: number
          requires_notification: boolean
          notification_days_before: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          item_id: string
          interval_weeks: number
          start_date: string
          end_date?: string | null
          last_executed_date?: string | null
          next_due_date: string
          status?: ScheduleStatus
          assigned_nurse_id?: string | null
          notes?: string | null
          priority?: number
          requires_notification?: boolean
          notification_days_before?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          item_id?: string
          interval_weeks?: number
          start_date?: string
          end_date?: string | null
          last_executed_date?: string | null
          next_due_date?: string
          status?: ScheduleStatus
          assigned_nurse_id?: string | null
          notes?: string | null
          priority?: number
          requires_notification?: boolean
          notification_days_before?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schedule_executions: {
        Row: {
          id: string
          schedule_id: string
          planned_date: string
          executed_date: string | null
          executed_time: string | null
          status: ExecutionStatus
          executed_by: string | null
          notes: string | null
          skipped_reason: string | null
          is_rescheduled: boolean
          original_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          planned_date: string
          executed_date?: string | null
          executed_time?: string | null
          status?: ExecutionStatus
          executed_by?: string | null
          notes?: string | null
          skipped_reason?: string | null
          is_rescheduled?: boolean
          original_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          planned_date?: string
          executed_date?: string | null
          executed_time?: string | null
          status?: ExecutionStatus
          executed_by?: string | null
          notes?: string | null
          skipped_reason?: string | null
          is_rescheduled?: boolean
          original_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          schedule_id: string | null
          execution_id: string | null
          recipient_id: string
          channel: NotificationChannel
          notify_date: string
          notify_time: string
          state: NotificationState
          title: string
          message: string
          metadata: Json
          sent_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          execution_id?: string | null
          recipient_id: string
          channel: NotificationChannel
          notify_date: string
          notify_time?: string
          state?: NotificationState
          title: string
          message: string
          metadata?: Json
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          execution_id?: string | null
          recipient_id?: string
          channel?: NotificationChannel
          notify_date?: string
          notify_time?: string
          state?: NotificationState
          title?: string
          message?: string
          metadata?: Json
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      database_health: {
        Row: {
          metric: string | null
          value: number | null
          unit: string | null
        }
      }
      performance_metrics: {
        Row: {
          schemaname: string | null
          tablename: string | null
          inserts: number | null
          updates: number | null
          deletes: number | null
          live_rows: number | null
          dead_rows: number | null
          last_vacuum: string | null
          last_autovacuum: string | null
          last_analyze: string | null
          last_autoanalyze: string | null
        }
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      get_my_schedules: {
        Args: {
          start_date?: string
          end_date?: string
        }
        Returns: Database['public']['Tables']['patient_schedules']['Row'][]
      }
      check_schedule_conflict: {
        Args: {
          p_nurse_id: string
          p_scheduled_date: string
          p_scheduled_time: string
          p_duration_minutes: number
          p_exclude_id?: string
        }
        Returns: boolean
      }
      get_db_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          metric: string
          value: number
          description: string
        }[]
      }
    }
    Enums: {
      user_role: UserRole
      schedule_status: ScheduleStatus
      appointment_type: AppointmentType
    }
  }
}

// Helper types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type PatientSchedule = Database['public']['Tables']['patient_schedules']['Row']
export type PatientScheduleInsert = Database['public']['Tables']['patient_schedules']['Insert']
export type PatientScheduleUpdate = Database['public']['Tables']['patient_schedules']['Update']

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

export type Item = Database['public']['Tables']['items']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']

export type Patient = Database['public']['Tables']['patients']['Row']
export type PatientInsert = Database['public']['Tables']['patients']['Insert']
export type PatientUpdate = Database['public']['Tables']['patients']['Update']

export type Schedule = Database['public']['Tables']['schedules']['Row']
export type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
export type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']

export type ScheduleExecution = Database['public']['Tables']['schedule_executions']['Row']
export type ScheduleExecutionInsert = Database['public']['Tables']['schedule_executions']['Insert']
export type ScheduleExecutionUpdate = Database['public']['Tables']['schedule_executions']['Update']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']