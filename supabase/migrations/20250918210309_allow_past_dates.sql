-- Migration: Allow past dates for schedules
-- This migration removes date validation constraints to allow scheduling of past dates
-- This is useful for data migration, historical record keeping, and testing

BEGIN;

-- Drop the CHECK constraint that prevents past dates on patient_schedules
ALTER TABLE public.patient_schedules
  DROP CONSTRAINT IF EXISTS future_appointment;

-- Update the handle_schedule_completion function to remove past date validation
CREATE OR REPLACE FUNCTION handle_schedule_completion(
  p_schedule_id UUID,
  p_new_next_due_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_schedule RECORD;
BEGIN
  -- Get schedule details
  SELECT
    ps.*,
    ns.name as nurse_name
  INTO v_schedule
  FROM public.schedules ps
  LEFT JOIN public.nurses ns ON ps.assigned_nurse_id = ns.id
  WHERE ps.id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Update schedule
  UPDATE public.schedules
  SET
    next_due_date = p_new_next_due_date,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_schedule_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Schedule completed successfully',
    'schedule_id', p_schedule_id,
    'next_due_date', p_new_next_due_date::text
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Update the generate_recurring_events function to remove past date validation
CREATE OR REPLACE FUNCTION generate_recurring_events(
  p_schedule_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB AS $$
DECLARE
  v_schedule RECORD;
  v_current_date DATE;
  v_count INTEGER := 0;
  v_result JSONB;
  v_interval_days INTEGER;
  v_total_events INTEGER;
  v_event_dates DATE[];
BEGIN
  -- Get schedule details
  SELECT
    id,
    patient_id,
    interval_unit,
    interval_value,
    assigned_nurse_id,
    duration_minutes,
    notes
  INTO v_schedule
  FROM public.schedules
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Input validation
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  -- Calculate interval in days
  v_interval_days := CASE v_schedule.interval_unit
    WHEN 'day' THEN v_schedule.interval_value
    WHEN 'week' THEN v_schedule.interval_value * 7
    WHEN 'month' THEN v_schedule.interval_value * 30  -- Approximation
    ELSE 7  -- Default to weekly
  END;

  -- Pre-calculate total events to limit
  v_total_events := CEIL((p_end_date - p_start_date + 1)::NUMERIC / v_interval_days);

  -- Limit total events to prevent excessive generation
  IF v_total_events > 365 THEN
    RAISE EXCEPTION 'Too many events to generate (%). Maximum allowed is 365', v_total_events;
  END IF;

  -- Generate events
  v_current_date := p_start_date;

  -- Collect all event dates first for batch insert
  WHILE v_current_date <= p_end_date LOOP
    v_event_dates := array_append(v_event_dates, v_current_date);
    v_count := v_count + 1;

    -- Calculate next date based on interval
    v_current_date := CASE v_schedule.interval_unit
      WHEN 'day' THEN v_current_date + (v_schedule.interval_value || ' days')::INTERVAL
      WHEN 'week' THEN v_current_date + (v_schedule.interval_value || ' weeks')::INTERVAL
      WHEN 'month' THEN v_current_date + (v_schedule.interval_value || ' months')::INTERVAL
      ELSE v_current_date + INTERVAL '1 week'
    END;
  END LOOP;

  -- Batch insert all events
  IF v_count > 0 THEN
    INSERT INTO public.patient_schedules (
      patient_id,
      nurse_id,
      scheduled_date,
      scheduled_time,
      status,
      test_type,
      duration_minutes,
      notes,
      created_by
    )
    SELECT
      v_schedule.patient_id,
      v_schedule.assigned_nurse_id,
      event_date,
      '09:00:00'::TIME,  -- Default time
      'scheduled',
      'recurring_event',
      v_schedule.duration_minutes,
      v_schedule.notes,
      auth.uid()
    FROM unnest(v_event_dates) AS event_date;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'events_created', v_count,
    'schedule_id', p_schedule_id,
    'start_date', p_start_date::text,
    'end_date', p_end_date::text
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Update schedule pause flow function to remove past date validation
CREATE OR REPLACE FUNCTION handle_schedule_pause_flow(
  p_schedule_id UUID,
  p_action TEXT,
  p_new_next_due_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_schedule RECORD;
BEGIN
  -- Get current schedule state with lock
  SELECT * INTO v_schedule
  FROM public.schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Perform action based on type
  IF p_action = 'pause' THEN
    IF v_schedule.status != 'active' THEN
      RAISE EXCEPTION 'Cannot pause schedule with status: %', v_schedule.status;
    END IF;

    UPDATE public.schedules
    SET
      status = 'paused',
      paused_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'pause',
      'message', 'Schedule paused successfully',
      'schedule_id', p_schedule_id
    );

  ELSIF p_action = 'resume' THEN
    IF v_schedule.status != 'paused' THEN
      RAISE EXCEPTION 'Cannot resume schedule with status: %', v_schedule.status;
    END IF;

    -- Removed: Past date validation check
    -- Allow any valid date to be set as next_due_date

    UPDATE public.schedules
    SET
      status = 'active',
      next_due_date = COALESCE(p_new_next_due_date, v_schedule.next_due_date),
      paused_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'resume',
      'message', 'Schedule resumed successfully',
      'schedule_id', p_schedule_id,
      'next_due_date', COALESCE(p_new_next_due_date, v_schedule.next_due_date)::TEXT
    );

  ELSE
    RAISE EXCEPTION 'Invalid action: %. Must be pause or resume', p_action;
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'schedule_id', p_schedule_id
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMIT;

-- Add comment explaining the change
COMMENT ON COLUMN public.patient_schedules.scheduled_date IS
  'The scheduled date for the appointment. Can be a past date for historical records or data migration.';

COMMENT ON COLUMN public.schedules.next_due_date IS
  'The next due date for the recurring schedule. Can be a past date for historical data or testing purposes.';