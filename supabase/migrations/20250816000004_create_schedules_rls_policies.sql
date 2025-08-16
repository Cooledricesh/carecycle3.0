-- Healthcare Scheduler RLS Policies for Patient Schedules
-- Migration: Row Level Security policies for patient_schedules table

-- RLS Policy: Nurses can view their own assigned schedules
CREATE POLICY "Nurses can view assigned schedules" ON public.patient_schedules
    FOR SELECT USING (
        nurse_id = auth.uid() OR
        created_by = auth.uid()
    );

-- RLS Policy: Nurses can view schedules in their department
CREATE POLICY "Nurses can view department schedules" ON public.patient_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role = 'nurse'
            AND department = patient_schedules.department
        )
    );

-- RLS Policy: Nurses can create schedules
CREATE POLICY "Nurses can create schedules" ON public.patient_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('nurse', 'admin')
            AND is_active = true
        )
    );

-- RLS Policy: Nurses can update their own schedules
CREATE POLICY "Nurses can update own schedules" ON public.patient_schedules
    FOR UPDATE USING (
        nurse_id = auth.uid() OR
        created_by = auth.uid()
    );

-- RLS Policy: Admins can view all schedules
CREATE POLICY "Admins can view all schedules" ON public.patient_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policy: Admins can update all schedules
CREATE POLICY "Admins can update all schedules" ON public.patient_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policy: Admins can delete schedules
CREATE POLICY "Admins can delete schedules" ON public.patient_schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to get schedules for current user
CREATE OR REPLACE FUNCTION public.get_my_schedules(
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE DEFAULT CURRENT_DATE + INTERVAL '7 days'
)
RETURNS SETOF public.patient_schedules AS $$
BEGIN
    RETURN QUERY
    SELECT s.* FROM public.patient_schedules s
    WHERE s.scheduled_date BETWEEN start_date AND end_date
    AND (s.nurse_id = auth.uid() OR s.created_by = auth.uid())
    ORDER BY s.scheduled_date, s.scheduled_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check schedule conflicts
CREATE OR REPLACE FUNCTION public.check_schedule_conflict(
    p_nurse_id UUID,
    p_scheduled_date DATE,
    p_scheduled_time TIME,
    p_duration_minutes INTEGER,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
    end_time TIME;
BEGIN
    end_time := p_scheduled_time + (p_duration_minutes || ' minutes')::INTERVAL;
    
    SELECT COUNT(*)
    INTO conflict_count
    FROM public.patient_schedules
    WHERE nurse_id = p_nurse_id
    AND scheduled_date = p_scheduled_date
    AND status NOT IN ('cancelled', 'no_show')
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
    AND (
        -- New appointment starts during existing appointment
        (p_scheduled_time >= scheduled_time AND p_scheduled_time < scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- New appointment ends during existing appointment
        (end_time > scheduled_time AND end_time <= scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- New appointment encompasses existing appointment
        (p_scheduled_time <= scheduled_time AND end_time >= scheduled_time + (duration_minutes || ' minutes')::INTERVAL)
    );
    
    RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;