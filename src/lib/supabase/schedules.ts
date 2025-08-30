'use client';

import { getSupabaseClient } from '@/lib/supabase/client';

export interface Schedule {
  id: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  appointment_type: 'consultation' | 'emergency' | 'follow_up' | 'routine_check' | 'treatment';
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  notes?: string;
  department?: string;
  room_number?: string;
  created_at: string;
  updated_at: string;
}

export async function getSchedules() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_schedules')
    .select('*')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }

  return data as Schedule[];
}

export async function getTodaySchedules() {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('patient_schedules')
    .select('*')
    .eq('scheduled_date', today)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching today schedules:', error);
    throw error;
  }

  return data as Schedule[];
}

export async function getUpcomingSchedules(limit = 5) {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('patient_schedules')
    .select('*')
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming schedules:', error);
    throw error;
  }

  return data as Schedule[];
}

export async function getSchedulesByDateRange(startDate: string, endDate: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_schedules')
    .select('*')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching schedules by date range:', error);
    throw error;
  }

  return data as Schedule[];
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_schedules')
    .insert([schedule])
    .select()
    .single();

  if (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }

  return data as Schedule;
}

export async function updateSchedule(id: string, updates: Partial<Omit<Schedule, 'id' | 'created_at' | 'updated_at'>>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }

  return data as Schedule;
}

export async function deleteSchedule(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('patient_schedules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
}