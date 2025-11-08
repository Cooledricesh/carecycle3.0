export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          organization_id: string | null
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          organization_id?: string | null
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          organization_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          code: string
          created_at: string | null
          default_interval_weeks: number | null
          description: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          notification_days_before: number | null
          organization_id: string
          preparation_notes: string | null
          requires_notification: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          default_interval_weeks?: number | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          notification_days_before?: number | null
          organization_id: string
          preparation_notes?: string | null
          requires_notification?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          default_interval_weeks?: number | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          notification_days_before?: number | null
          organization_id?: string
          preparation_notes?: string | null
          requires_notification?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string | null
          error_message: string | null
          execution_id: string | null
          id: string
          message: string
          metadata: Json | null
          notify_date: string
          notify_time: string | null
          organization_id: string
          recipient_id: string
          schedule_id: string | null
          sent_at: string | null
          state: Database["public"]["Enums"]["notification_state"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notify_date: string
          notify_time?: string | null
          organization_id: string
          recipient_id: string
          schedule_id?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notify_date?: string
          notify_time?: string | null
          organization_id?: string
          recipient_id?: string
          schedule_id?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "schedule_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "dashboard_schedule_summary"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_schedules: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          created_at: string | null
          created_by: string | null
          department: string | null
          duration_minutes: number
          id: string
          notes: string | null
          nurse_id: string | null
          patient_name: string
          room_number: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at: string | null
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          nurse_id?: string | null
          patient_name: string
          room_number?: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at?: string | null
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          nurse_id?: string | null
          patient_name?: string
          room_number?: string | null
          scheduled_date?: string
          scheduled_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_schedules_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_schedules_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          assigned_doctor_name: string | null
          care_type: string | null
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          organization_id: string
          original_patient_number: string | null
          patient_number: string
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          assigned_doctor_name?: string | null
          care_type?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          organization_id: string
          original_patient_number?: string | null
          patient_number: string
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          assigned_doctor_name?: string | null
          care_type?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          original_patient_number?: string | null
          patient_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          care_type: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          phone: string | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          care_type?: string | null
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          care_type?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      query_performance_log: {
        Row: {
          cache_hit: boolean | null
          created_at: string | null
          execution_time_ms: number | null
          filter_params: Json | null
          id: string
          query_type: string
          row_count: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          created_at?: string | null
          execution_time_ms?: number | null
          filter_params?: Json | null
          id?: string
          query_type: string
          row_count?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          created_at?: string | null
          execution_time_ms?: number | null
          filter_params?: Json | null
          id?: string
          query_type?: string
          row_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_performance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_performance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_executions: {
        Row: {
          care_type_at_completion: string | null
          created_at: string | null
          doctor_id_at_completion: string | null
          executed_by: string | null
          executed_date: string | null
          executed_time: string | null
          id: string
          is_rescheduled: boolean | null
          notes: string | null
          organization_id: string
          original_date: string | null
          planned_date: string
          schedule_id: string
          skipped_reason: string | null
          status: Database["public"]["Enums"]["execution_status"] | null
          updated_at: string | null
        }
        Insert: {
          care_type_at_completion?: string | null
          created_at?: string | null
          doctor_id_at_completion?: string | null
          executed_by?: string | null
          executed_date?: string | null
          executed_time?: string | null
          id?: string
          is_rescheduled?: boolean | null
          notes?: string | null
          organization_id: string
          original_date?: string | null
          planned_date: string
          schedule_id: string
          skipped_reason?: string | null
          status?: Database["public"]["Enums"]["execution_status"] | null
          updated_at?: string | null
        }
        Update: {
          care_type_at_completion?: string | null
          created_at?: string | null
          doctor_id_at_completion?: string | null
          executed_by?: string | null
          executed_date?: string | null
          executed_time?: string | null
          id?: string
          is_rescheduled?: boolean | null
          notes?: string | null
          organization_id?: string
          original_date?: string | null
          planned_date?: string
          schedule_id?: string
          skipped_reason?: string | null
          status?: Database["public"]["Enums"]["execution_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_executions_doctor_id_at_completion_fkey"
            columns: ["doctor_id_at_completion"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_doctor_id_at_completion_fkey"
            columns: ["doctor_id_at_completion"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "dashboard_schedule_summary"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedule_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_logs: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          schedule_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          schedule_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "dashboard_schedule_summary"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedule_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          assigned_nurse_id: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          interval_weeks: number
          item_id: string
          last_executed_date: string | null
          next_due_date: string
          notes: string | null
          notification_days_before: number | null
          organization_id: string
          patient_id: string
          priority: number | null
          requires_notification: boolean | null
          start_date: string
          status: Database["public"]["Enums"]["schedule_status"] | null
          updated_at: string | null
        }
        Insert: {
          assigned_nurse_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          interval_weeks: number
          item_id: string
          last_executed_date?: string | null
          next_due_date: string
          notes?: string | null
          notification_days_before?: number | null
          organization_id: string
          patient_id: string
          priority?: number | null
          requires_notification?: boolean | null
          start_date: string
          status?: Database["public"]["Enums"]["schedule_status"] | null
          updated_at?: string | null
        }
        Update: {
          assigned_nurse_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          interval_weeks?: number
          item_id?: string
          last_executed_date?: string | null
          next_due_date?: string
          notes?: string | null
          notification_days_before?: number | null
          organization_id?: string
          patient_id?: string
          priority?: number | null
          requires_notification?: boolean | null
          start_date?: string
          status?: Database["public"]["Enums"]["schedule_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_assigned_nurse_id_fkey"
            columns: ["assigned_nurse_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_assigned_nurse_id_fkey"
            columns: ["assigned_nurse_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_doctor_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          default_care_types: string[] | null
          default_date_range_days: number | null
          last_filter_state: Json | null
          show_all_patients: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_care_types?: string[] | null
          default_date_range_days?: number | null
          last_filter_state?: Json | null
          show_all_patients?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_care_types?: string[] | null
          default_date_range_days?: number | null
          last_filter_state?: Json | null
          show_all_patients?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      calendar_monthly_summary: {
        Row: {
          active_schedules: number | null
          completed_executions: number | null
          month: string | null
          unique_items: number | null
          unique_patients: number | null
        }
        Relationships: []
      }
      dashboard_schedule_summary: {
        Row: {
          care_type: string | null
          created_at: string | null
          doctor_id: string | null
          doctor_name: string | null
          interval_weeks: number | null
          item_category: string | null
          item_id: string | null
          item_name: string | null
          next_due_date: string | null
          notes: string | null
          patient_id: string | null
          patient_name: string | null
          patient_number: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["schedule_status"] | null
          updated_at: string | null
          urgency_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_doctor_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_summary: {
        Row: {
          completed_count: number | null
          completion_rate: number | null
          overdue_count: number | null
          planned_count: number | null
          total_count: number | null
          upcoming_schedules: number | null
        }
        Relationships: []
      }
      patient_doctor_view: {
        Row: {
          archived: boolean | null
          assigned_doctor_name: string | null
          care_type: string | null
          created_at: string | null
          doctor_approval_status:
            | Database["public"]["Enums"]["approval_status"]
            | null
          doctor_display_name: string | null
          doctor_email: string | null
          doctor_id: string | null
          doctor_role: Database["public"]["Enums"]["user_role"] | null
          doctor_status: string | null
          id: string | null
          is_active: boolean | null
          patient_name: string | null
          patient_number: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profile_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          row_count: number | null
          table_name: unknown
          table_size_bytes: number | null
          table_size_pretty: string | null
          total_size_bytes: number | null
          total_size_pretty: string | null
        }
        Relationships: []
      }
      profile_basic_info: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_user:
        | {
            Args: {
              p_remaining_admins: number
              p_target_role: string
              p_user_id: string
            }
            Returns: Json
          }
        | { Args: { p_user_id: string }; Returns: Json }
      approve_join_request: {
        Args: {
          p_admin_id: string
          p_assigned_role?: string
          p_join_request_id: string
        }
        Returns: boolean
      }
      approve_user: {
        Args: { approved_by_id?: string; user_id: string }
        Returns: boolean
      }
      archive_patient_with_timestamp: {
        Args: { patient_id: string }
        Returns: undefined
      }
      bulk_archive_patients: {
        Args: { archive_reason?: string; patient_ids: string[] }
        Returns: Json
      }
      calculate_next_due_date: {
        Args: { p_interval_days: number; p_reference_date: string }
        Returns: string
      }
      check_is_admin: { Args: { user_id: string }; Returns: boolean }
      check_schedule_conflict: {
        Args: {
          p_duration_minutes: number
          p_exclude_id?: string
          p_nurse_id: string
          p_scheduled_date: string
          p_scheduled_time: string
        }
        Returns: boolean
      }
      complete_schedule_execution: {
        Args: {
          p_executed_by: string
          p_executed_date: string
          p_notes?: string
          p_planned_date: string
          p_schedule_id: string
        }
        Returns: undefined
      }
      create_bulk_schedules: {
        Args: {
          p_assigned_nurse_id?: string
          p_interval_days: number
          p_item_id: string
          p_patient_ids: string[]
          p_requires_notification?: boolean
          p_start_date: string
        }
        Returns: number
      }
      create_organization_and_register_user: {
        Args: {
          p_organization_name: string
          p_user_id: string
          p_user_name: string
          p_user_role?: string
        }
        Returns: string
      }
      deactivate_user: {
        Args: { reason?: string; user_id: string }
        Returns: boolean
      }
      decrypt_patient_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      decrypt_text: { Args: { encrypted_data: string }; Returns: string }
      encrypt_patient_data: { Args: { plain_text: string }; Returns: string }
      encrypt_text: { Args: { plain_text: string }; Returns: string }
      generate_recurring_events: {
        Args: {
          p_end_date: string
          p_schedule_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_calendar_schedules: {
        Args: { p_end_date: string; p_start_date: string; p_user_id?: string }
        Returns: {
          care_type: string
          display_date: string
          display_type: string
          doctor_id: string
          doctor_name: string
          executed_by: string
          execution_id: string
          execution_notes: string
          interval_weeks: number
          item_category: string
          item_id: string
          item_name: string
          patient_id: string
          patient_name: string
          patient_number: string
          priority: number
          schedule_id: string
          schedule_status: string
        }[]
      }
      get_calendar_schedules_filtered: {
        Args: {
          p_care_types?: string[]
          p_end_date: string
          p_show_all?: boolean
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          care_type: string
          care_type_at_completion: string
          display_date: string
          display_type: string
          doctor_id: string
          doctor_id_at_completion: string
          executed_by: string
          execution_id: string
          execution_notes: string
          interval_weeks: number
          item_category: string
          item_id: string
          item_name: string
          patient_id: string
          patient_name: string
          priority: number
          schedule_id: string
          schedule_status: string
        }[]
      }
      get_current_user_org_id: { Args: never; Returns: string }
      get_current_user_organization_id: { Args: never; Returns: string }
      get_current_user_profile: {
        Args: never
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          care_type: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          phone: string | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_db_stats: {
        Args: never
        Returns: {
          description: string
          metric: string
          value: number
        }[]
      }
      get_encryption_key: { Args: never; Returns: string }
      get_filter_statistics: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: {
          my_patients: number
          overdue_schedules: number
          today_schedules: number
          total_patients: number
          total_schedules: number
          upcoming_schedules: number
        }[]
      }
      get_filtered_schedules: {
        Args: {
          p_care_types?: string[]
          p_date_end?: string
          p_date_start?: string
          p_show_all?: boolean
          p_user_id: string
        }
        Returns: {
          created_at: string
          doctor_id: string
          doctor_name: string
          interval_weeks: number
          item_category: string
          item_id: string
          item_name: string
          next_due_date: string
          notes: string
          patient_care_type: string
          patient_id: string
          patient_name: string
          patient_number: string
          priority: number
          schedule_id: string
          status: string
          updated_at: string
        }[]
      }
      get_my_schedules: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          created_at: string | null
          created_by: string | null
          department: string | null
          duration_minutes: number
          id: string
          notes: string | null
          nurse_id: string | null
          patient_name: string
          room_number: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "patient_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_or_create_execution: {
        Args: { p_planned_date: string; p_schedule_id: string }
        Returns: string
      }
      get_pending_doctor_names: {
        Args: never
        Returns: {
          name: string
          patient_count: number
        }[]
      }
      get_schedule_pause_statistics: {
        Args: { p_schedule_id?: string }
        Returns: {
          last_pause_date: string
          last_resume_date: string
          missed_executions_count: number
          schedule_id: string
          total_pause_duration_days: number
          total_pauses: number
        }[]
      }
      get_schedule_statistics: {
        Args: { p_schedule_id: string }
        Returns: {
          completed_count: number
          completion_rate: number
          first_execution_date: string
          last_execution_date: string
          skipped_count: number
          total_executions: number
        }[]
      }
      get_today_checklist: {
        Args: { p_show_all?: boolean; p_user_id: string }
        Returns: {
          completed: boolean
          doctor_id: string
          item_category: string
          item_name: string
          patient_care_type: string
          patient_id: string
          patient_name: string
          schedule_id: string
          status: string
        }[]
      }
      get_user_profile_for_audit: {
        Args: { target_user_id: string }
        Returns: {
          email: string
          id: string
          name: string
          role: string
        }[]
      }
      handle_schedule_completion: {
        Args: { p_new_next_due_date: string; p_schedule_id: string }
        Returns: Json
      }
      handle_schedule_pause_flow: {
        Args: {
          p_action: string
          p_new_next_due_date?: string
          p_schedule_id: string
        }
        Returns: Json
      }
      import_patients_csv: {
        Args: { p_csv_data: string; p_hospital_id?: string }
        Returns: {
          error_count: number
          errors: Json
          imported_count: number
        }[]
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_approved: { Args: { user_id: string }; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_user_active_and_approved: { Args: never; Returns: boolean }
      is_user_admin: { Args: never; Returns: boolean }
      refresh_dashboard_summary: { Args: never; Returns: undefined }
      reject_join_request: {
        Args: {
          p_admin_id: string
          p_join_request_id: string
          p_rejection_reason?: string
        }
        Returns: boolean
      }
      reject_user: {
        Args: { reason?: string; rejected_by_id?: string; user_id: string }
        Returns: boolean
      }
      restore_archived_patient: {
        Args: { patient_id: string }
        Returns: undefined
      }
      restore_patient_atomic: {
        Args: {
          patient_id: string
          update_care_type?: string
          update_name?: string
        }
        Returns: {
          archived: boolean
          archived_at: string
          care_type: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          original_patient_number: string
          patient_number: string
          updated_at: string
        }[]
      }
      safe_date_series: {
        Args: {
          p_end_date: string
          p_interval_weeks: number
          p_start_date: string
        }
        Returns: {
          series_date: string
        }[]
      }
      search_organizations: {
        Args: { p_limit?: number; p_search_term: string }
        Returns: {
          created_at: string
          id: string
          member_count: number
          name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_user_care_type: {
        Args: { new_care_type: string; target_user_id: string }
        Returns: Json
      }
      update_user_profile_admin: {
        Args: {
          new_care_type?: string
          new_role?: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Returns: Json
      }
      update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Returns: Json
      }
      validate_schedule_resume: {
        Args: { p_resume_date: string; p_schedule_id: string }
        Returns: Json
      }
    }
    Enums: {
      appointment_type:
        | "consultation"
        | "treatment"
        | "follow_up"
        | "emergency"
        | "routine_check"
      approval_status: "pending" | "approved" | "rejected"
      execution_status: "planned" | "completed" | "skipped" | "overdue"
      notification_channel: "dashboard" | "push" | "email"
      notification_state: "pending" | "ready" | "sent" | "failed" | "cancelled"
      schedule_status:
        | "active"
        | "paused"
        | "completed"
        | "deleted"
        | "cancelled"
      user_role: "nurse" | "admin" | "doctor" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_type: [
        "consultation",
        "treatment",
        "follow_up",
        "emergency",
        "routine_check",
      ],
      approval_status: ["pending", "approved", "rejected"],
      execution_status: ["planned", "completed", "skipped", "overdue"],
      notification_channel: ["dashboard", "push", "email"],
      notification_state: ["pending", "ready", "sent", "failed", "cancelled"],
      schedule_status: [
        "active",
        "paused",
        "completed",
        "deleted",
        "cancelled",
      ],
      user_role: ["nurse", "admin", "doctor", "super_admin"],
    },
  },
} as const

// Commonly used type exports
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Item = Database['public']['Tables']['items']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']

export type Schedule = Database['public']['Tables']['schedules']['Row']
export type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
export type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']

export type Patient = Database['public']['Tables']['patients']['Row']
export type PatientInsert = Database['public']['Tables']['patients']['Insert']
export type PatientUpdate = Database['public']['Tables']['patients']['Update']

// ItemCategory is a string literal union, not an enum in the database
export type ItemCategory = 'test' | 'injection' | 'medication' | 'procedure' | 'other'
export type ScheduleStatus = Database['public']['Enums']['schedule_status']
export type UserRole = Database['public']['Enums']['user_role']
