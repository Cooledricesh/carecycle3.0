-- Healthcare Scheduler Patient Schedules
-- Migration: Create patient schedules table for the healthcare scheduler

-- Create enum for schedule status
CREATE TYPE schedule_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Create enum for appointment type
CREATE TYPE appointment_type AS ENUM ('consultation', 'treatment', 'follow_up', 'emergency', 'routine_check');

-- Create patient_schedules table
CREATE TABLE public.patient_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_email TEXT,
    nurse_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    appointment_type appointment_type NOT NULL DEFAULT 'consultation',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status schedule_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    department TEXT,
    room_number TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    CONSTRAINT future_appointment CHECK (scheduled_date >= CURRENT_DATE)
);

-- Enable RLS on patient_schedules table
ALTER TABLE public.patient_schedules ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_patient_schedules_nurse_id ON public.patient_schedules(nurse_id);
CREATE INDEX idx_patient_schedules_date ON public.patient_schedules(scheduled_date);
CREATE INDEX idx_patient_schedules_status ON public.patient_schedules(status);
CREATE INDEX idx_patient_schedules_department ON public.patient_schedules(department);
CREATE INDEX idx_patient_schedules_created_by ON public.patient_schedules(created_by);

-- Composite indexes for common queries
CREATE INDEX idx_patient_schedules_nurse_date_status ON public.patient_schedules(nurse_id, scheduled_date, status);
CREATE INDEX idx_patient_schedules_date_time ON public.patient_schedules(scheduled_date, scheduled_time);
CREATE INDEX idx_patient_schedules_department_date ON public.patient_schedules(department, scheduled_date);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_patient_schedules_updated_at
    BEFORE UPDATE ON public.patient_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();