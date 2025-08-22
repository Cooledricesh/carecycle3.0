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

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentType = 'consultation' | 'treatment' | 'follow_up' | 'emergency' | 'routine_check'

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