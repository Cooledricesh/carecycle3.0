-- Fix prepared statement already exists error (42P10) in schedule resume functions
-- This error occurs when the same prepared statement name is used multiple times
-- Solution: Use dynamic SQL or avoid prepared statements in functions

BEGIN;

-- =====================================================
-- 1. Drop and recreate validate_schedule_resume function with proper execution
-- =====================================================
DROP FUNCTION IF EXISTS validate_schedule_resume(UUID, DATE);

CREATE OR REPLACE FUNCTION validate_schedule_resume(
    p_schedule_id UUID,
    p_resume_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule RECORD;
    v_result JSONB;
    v_missed_count INTEGER := 0;
    v_pause_duration_weeks INTEGER := 0;
    v_validation_errors TEXT[] := ARRAY[]::TEXT[];
    v_warnings TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Input validation
    IF p_schedule_id IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Schedule ID is required'],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
    END IF;

    IF p_resume_date IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Resume date is required'],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
    END IF;

    -- Fetch schedule with error handling
    BEGIN
        SELECT * INTO v_schedule
        FROM schedules
        WHERE id = p_schedule_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'valid', false,
                'errors', ARRAY['Schedule not found'],
                'warnings', ARRAY[]::TEXT[],
                'missed_executions', 0,
                'pause_duration_weeks', 0
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'valid', false,
                'errors', ARRAY['Error fetching schedule: ' || SQLERRM],
                'warnings', ARRAY[]::TEXT[],
                'missed_executions', 0,
                'pause_duration_weeks', 0
            );
    END;

    -- Validate schedule status
    IF v_schedule.status != 'paused' THEN
        v_validation_errors := array_append(v_validation_errors,
            'Schedule must be paused to resume (current: ' || v_schedule.status || ')');
    END IF;

    -- Validate resume date
    IF p_resume_date < CURRENT_DATE THEN
        v_validation_errors := array_append(v_validation_errors,
            'Resume date cannot be in the past');
    END IF;

    -- Check end date
    IF v_schedule.end_date IS NOT NULL AND p_resume_date > v_schedule.end_date THEN
        v_validation_errors := array_append(v_validation_errors,
            'Resume date cannot be after schedule end date');
    END IF;

    -- Calculate pause duration (safe calculation)
    IF v_schedule.updated_at IS NOT NULL THEN
        v_pause_duration_weeks := GREATEST(0,
            EXTRACT(EPOCH FROM (p_resume_date - v_schedule.updated_at::date)) / 604800)::INTEGER;

        IF v_pause_duration_weeks > 52 THEN
            v_warnings := array_append(v_warnings,
                'Schedule has been paused for over a year');
        END IF;
    END IF;

    -- Calculate missed executions with safe generate_series
    IF v_schedule.next_due_date IS NOT NULL
       AND v_schedule.interval_weeks IS NOT NULL
       AND v_schedule.interval_weeks > 0
       AND v_schedule.next_due_date <= CURRENT_DATE THEN

        -- Use dynamic SQL to avoid prepared statement conflicts
        BEGIN
            EXECUTE format(
                'SELECT COUNT(*)::INTEGER FROM generate_series($1::date, $2::date, ($3 || '' weeks'')::interval) AS missed_date WHERE missed_date < $4::date'
            ) INTO v_missed_count
            USING v_schedule.next_due_date, CURRENT_DATE, v_schedule.interval_weeks, CURRENT_DATE;
        EXCEPTION
            WHEN OTHERS THEN
                -- If generate_series fails, log and continue
                RAISE WARNING 'Could not calculate missed executions: %', SQLERRM;
                v_missed_count := 0;
                v_warnings := array_append(v_warnings,
                    'Could not calculate exact missed executions');
        END;

        IF v_missed_count > 0 THEN
            v_warnings := array_append(v_warnings,
                format('%s executions were missed during pause', v_missed_count));
        END IF;
    END IF;

    -- Return validation result
    RETURN jsonb_build_object(
        'valid', array_length(v_validation_errors, 1) IS NULL OR array_length(v_validation_errors, 1) = 0,
        'errors', COALESCE(v_validation_errors, ARRAY[]::TEXT[]),
        'warnings', COALESCE(v_warnings, ARRAY[]::TEXT[]),
        'missed_executions', v_missed_count,
        'pause_duration_weeks', v_pause_duration_weeks,
        'schedule_info', jsonb_build_object(
            'id', v_schedule.id,
            'status', v_schedule.status,
            'next_due_date', v_schedule.next_due_date,
            'interval_weeks', v_schedule.interval_weeks,
            'end_date', v_schedule.end_date,
            'paused_at', v_schedule.updated_at
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Catch-all error handler
        RETURN jsonb_build_object(
            'valid', false,
            'errors', ARRAY['Unexpected error: ' || SQLERRM],
            'warnings', ARRAY[]::TEXT[],
            'missed_executions', 0,
            'pause_duration_weeks', 0
        );
END;
$$;

-- =====================================================
-- 2. Update handle_schedule_state_change trigger to avoid prepared statement conflicts
-- =====================================================
CREATE OR REPLACE FUNCTION handle_schedule_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_planned_date DATE;
    v_end_date DATE;
    v_interval_weeks INTEGER;
    v_date_cursor DATE;
    v_count INTEGER := 0;
BEGIN
    -- Only process on status change to 'active' from 'paused'
    IF NEW.status = 'active' AND OLD.status = 'paused' THEN
        -- Get the schedule interval
        v_interval_weeks := COALESCE(NEW.interval_weeks, OLD.interval_weeks, 1);

        -- Ensure we have a valid interval
        IF v_interval_weeks <= 0 THEN
            v_interval_weeks := 1;
        END IF;

        -- Use cursor-based approach instead of generate_series to avoid conflicts
        v_date_cursor := NEW.next_due_date;
        v_end_date := COALESCE(NEW.end_date, CURRENT_DATE + INTERVAL '2 years');

        -- Create planned executions using a loop instead of generate_series
        WHILE v_date_cursor <= v_end_date AND v_count < 52 LOOP
            -- Check if execution already exists
            IF NOT EXISTS (
                SELECT 1 FROM schedule_executions
                WHERE schedule_id = NEW.id
                AND planned_date = v_date_cursor
                AND status = 'planned'
            ) THEN
                -- Insert new execution
                INSERT INTO schedule_executions (
                    schedule_id,
                    planned_date,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    v_date_cursor,
                    'planned',
                    NOW(),
                    NOW()
                )
                ON CONFLICT (schedule_id, planned_date)
                DO UPDATE SET
                    status = CASE
                        WHEN schedule_executions.status = 'cancelled' THEN 'planned'
                        ELSE schedule_executions.status
                    END,
                    updated_at = NOW();
            END IF;

            -- Move to next date
            v_date_cursor := v_date_cursor + (v_interval_weeks * INTERVAL '1 week');
            v_count := v_count + 1;
        END LOOP;

        -- Update cancelled notifications back to pending
        UPDATE notifications
        SET state = 'pending',
            updated_at = NOW()
        WHERE schedule_id = NEW.id
        AND state = 'cancelled'
        AND notify_date >= NEW.next_due_date;
    END IF;

    -- Log the state change
    INSERT INTO schedule_logs (
        schedule_id,
        action,
        old_values,
        new_values,
        changed_at,
        changed_by
    )
    VALUES (
        NEW.id,
        'status_change',
        jsonb_build_object('status', OLD.status, 'next_due_date', OLD.next_due_date),
        jsonb_build_object('status', NEW.status, 'next_due_date', NEW.next_due_date),
        NOW(),
        auth.uid()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in handle_schedule_state_change: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- =====================================================
-- 3. Create helper function to safely calculate date ranges
-- =====================================================
CREATE OR REPLACE FUNCTION safe_date_series(
    p_start_date DATE,
    p_end_date DATE,
    p_interval_weeks INTEGER
)
RETURNS TABLE(series_date DATE)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_current_date DATE;
    v_count INTEGER := 0;
    v_max_count INTEGER := 1000; -- Safety limit
BEGIN
    -- Input validation
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_interval_weeks IS NULL THEN
        RETURN;
    END IF;

    IF p_interval_weeks <= 0 THEN
        RETURN;
    END IF;

    IF p_start_date > p_end_date THEN
        RETURN;
    END IF;

    -- Generate dates using loop instead of generate_series
    v_current_date := p_start_date;

    WHILE v_current_date <= p_end_date AND v_count < v_max_count LOOP
        series_date := v_current_date;
        RETURN NEXT;

        v_current_date := v_current_date + (p_interval_weeks * INTERVAL '1 week');
        v_count := v_count + 1;
    END LOOP;

    RETURN;
END;
$$;

-- =====================================================
-- 4. Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION validate_schedule_resume(UUID, DATE) IS
'Validates schedule resume with dynamic SQL to avoid prepared statement conflicts.
Uses EXECUTE for generate_series to prevent error 42P10.
Returns comprehensive validation result with error and warning messages.';

COMMENT ON FUNCTION handle_schedule_state_change() IS
'Trigger function that handles schedule state changes.
Uses loop-based approach instead of generate_series to avoid prepared statement conflicts.
Creates planned executions when resuming from paused state.';

COMMENT ON FUNCTION safe_date_series(DATE, DATE, INTEGER) IS
'Safe alternative to generate_series for date ranges.
Uses loop-based approach to avoid prepared statement conflicts.
Includes input validation and safety limits.';

-- =====================================================
-- 5. Grant necessary permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION validate_schedule_resume(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_date_series(DATE, DATE, INTEGER) TO authenticated;

COMMIT;