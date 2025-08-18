// Database Types - Auto-generated from Supabase Schema
// Version: 1.0.0
// Generated: 2025-08-18

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enum Types
export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type ExecutionStatus = 'planned' | 'completed' | 'skipped' | 'overdue'
export type NotificationChannel = 'dashboard' | 'push' | 'email'
export type NotificationState = 'pending' | 'ready' | 'sent' | 'failed'
export type UserRole = 'nurse' | 'admin' | 'user'
export type ItemCategory = '검사' | '주사' | '처치' | '기타'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          role: UserRole | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: UserRole | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          role?: UserRole | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          hospital_id: string | null
          patient_number_encrypted: string
          name_encrypted: string
          name_search: unknown | null
          department: string | null
          is_active: boolean
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hospital_id?: string | null
          patient_number_encrypted: string
          name_encrypted: string
          name_search?: unknown | null
          department?: string | null
          is_active?: boolean
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hospital_id?: string | null
          patient_number_encrypted?: string
          name_encrypted?: string
          name_search?: unknown | null
          department?: string | null
          is_active?: boolean
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          code: string
          name: string
          category: ItemCategory
          default_interval_days: number
          description: string | null
          instructions: string | null
          preparation_notes: string | null
          requires_notification: boolean
          notification_days_before: number
          is_active: boolean
          sort_order: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          category: ItemCategory
          default_interval_days?: number
          description?: string | null
          instructions?: string | null
          preparation_notes?: string | null
          requires_notification?: boolean
          notification_days_before?: number
          is_active?: boolean
          sort_order?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          category?: ItemCategory
          default_interval_days?: number
          description?: string | null
          instructions?: string | null
          preparation_notes?: string | null
          requires_notification?: boolean
          notification_days_before?: number
          is_active?: boolean
          sort_order?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          patient_id: string
          item_id: string
          interval_days: number
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
          interval_days: number
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
          interval_days?: number
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
      schedule_logs: {
        Row: {
          id: string
          schedule_id: string
          action: string
          old_values: Json | null
          new_values: Json | null
          changed_by: string | null
          changed_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          schedule_id: string
          action: string
          old_values?: Json | null
          new_values?: Json | null
          changed_by?: string | null
          changed_at?: string
          reason?: string | null
        }
        Update: {
          id?: string
          schedule_id?: string
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          changed_by?: string | null
          changed_at?: string
          reason?: string | null
        }
      }
    }
    Views: {
      patients_secure: {
        Row: {
          id: string
          hospital_id: string | null
          patient_number: string | null
          name: string | null
          department: string | null
          is_active: boolean
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
      }
      today_checklist: {
        Row: {
          execution_id: string
          schedule_id: string
          patient_id: string
          patient_name: string | null
          patient_number: string | null
          department: string | null
          item_name: string
          item_category: ItemCategory
          instructions: string | null
          planned_date: string
          executed_date: string | null
          executed_time: string | null
          execution_status: ExecutionStatus
          assigned_nurse_id: string | null
          assigned_nurse_name: string | null
          schedule_notes: string | null
          execution_notes: string | null
          priority: number
        }
      }
      dashboard_summary: {
        Row: {
          completed_count: number
          planned_count: number
          overdue_count: number
          total_count: number
          upcoming_schedules: number
          completion_rate: number
        }
      }
    }
    Functions: {
      encrypt_patient_data: {
        Args: { plain_text: string }
        Returns: string // bytea is returned as base64 string in JS
      }
      decrypt_patient_data: {
        Args: { encrypted_data: string } // bytea is passed as base64 string in JS
        Returns: string
      }
      calculate_next_due_date: {
        Args: {
          p_interval_days: number
          p_reference_date: string
        }
        Returns: string
      }
      import_patients_csv: {
        Args: {
          p_csv_data: string
          p_hospital_id?: string
        }
        Returns: {
          imported_count: number
          error_count: number
          errors: Json
        }[]
      }
      create_bulk_schedules: {
        Args: {
          p_patient_ids: string[]
          p_item_id: string
          p_interval_days: number
          p_start_date: string
          p_assigned_nurse_id?: string
          p_requires_notification?: boolean
        }
        Returns: number
      }
    }
    Enums: {
      schedule_status: ScheduleStatus
      execution_status: ExecutionStatus
      notification_channel: NotificationChannel
      notification_state: NotificationState
    }
  }
}