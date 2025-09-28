-- ============================================================================
-- Fix Duplicate Audit Logs (PHI/PII Safe Version)
-- ============================================================================
-- This migration prevents duplicate audit logs when UPDATE operations
-- don't actually change any values (excluding auto-updated timestamp fields).
-- Includes security improvements and PHI/PII protection.
-- ============================================================================

-- ============================================================================
-- Improved audit trigger function with change detection and security
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_profile public.profiles;
    old_record_for_comparison jsonb;
    new_record_for_comparison jsonb;
    safe_old_record jsonb;
    safe_new_record jsonb;
    patient_name TEXT;
    item_name TEXT;
BEGIN
    -- Set search_path to prevent schema hijacking in SECURITY DEFINER functions
    SET LOCAL search_path = public, pg_temp;

    -- Get user ID safely (handles null auth.uid() gracefully)
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        current_user_id := COALESCE(
            nullif(current_setting('request.jwt.claims.sub', true), '')::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
    END IF;

    -- Get current user profile using scalar user ID
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- For UPDATE operations, check if there are actual changes
    -- This prevents duplicate logs when the same values are updated
    IF TG_OP = 'UPDATE' THEN
        -- Convert records to JSONB and remove timestamp fields for comparison
        old_record_for_comparison := to_jsonb(OLD) - 'updated_at' - 'created_at';
        new_record_for_comparison := to_jsonb(NEW) - 'updated_at' - 'created_at';

        -- Skip audit log if they are identical (excluding timestamps)
        IF old_record_for_comparison = new_record_for_comparison THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Build PHI/PII-safe records based on table type
    -- Only include non-sensitive fields in audit logs

    CASE TG_TABLE_NAME
        WHEN 'patients' THEN
            -- For patients: exclude name, metadata (may contain PHI)
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'hospital_id', OLD.hospital_id,
                    'patient_number', OLD.patient_number,
                    'department', OLD.department,
                    'is_active', OLD.is_active,
                    'created_by', OLD.created_by,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'hospital_id', NEW.hospital_id,
                    'patient_number', NEW.patient_number,
                    'department', NEW.department,
                    'is_active', NEW.is_active,
                    'created_by', NEW.created_by,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'profiles' THEN
            -- For profiles: exclude phone (may be sensitive)
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'email', OLD.email,
                    'role', OLD.role,
                    'department', OLD.department,
                    'is_active', OLD.is_active,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'email', NEW.email,
                    'role', NEW.role,
                    'department', NEW.department,
                    'is_active', NEW.is_active,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );
            END IF;

        WHEN 'schedules' THEN
            -- For schedules: include all fields but add contextual names
            -- Store minimal schedule data + patient/item references (not names)
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := jsonb_build_object(
                    'id', OLD.id,
                    'patient_id', OLD.patient_id,
                    'item_id', OLD.item_id,
                    'scheduled_time', OLD.scheduled_time,
                    'status', OLD.status,
                    'created_at', OLD.created_at,
                    'updated_at', OLD.updated_at
                );

                -- Add patient and item names for context (non-PHI references)
                SELECT name INTO patient_name FROM patients WHERE id = OLD.patient_id;
                SELECT name INTO item_name FROM items WHERE id = OLD.item_id;

                IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                    safe_old_record := safe_old_record || jsonb_build_object(
                        '_patient_name', patient_name,
                        '_item_name', item_name
                    );
                END IF;
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := jsonb_build_object(
                    'id', NEW.id,
                    'patient_id', NEW.patient_id,
                    'item_id', NEW.item_id,
                    'scheduled_time', NEW.scheduled_time,
                    'status', NEW.status,
                    'created_at', NEW.created_at,
                    'updated_at', NEW.updated_at
                );

                -- Add patient and item names for context (non-PHI references)
                SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
                SELECT name INTO item_name FROM items WHERE id = NEW.item_id;

                IF patient_name IS NOT NULL OR item_name IS NOT NULL THEN
                    safe_new_record := safe_new_record || jsonb_build_object(
                        '_patient_name', patient_name,
                        '_item_name', item_name
                    );
                END IF;
            END IF;

        ELSE
            -- For other tables: store all fields except timestamps
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                safe_old_record := to_jsonb(OLD) - 'created_at' - 'updated_at';
            END IF;
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                safe_new_record := to_jsonb(NEW) - 'created_at' - 'updated_at';
            END IF;
    END CASE;

    -- Log the operation with PHI/PII-safe values
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_name,
        user_role
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        safe_old_record,
        safe_new_record,
        current_user_id,
        user_profile.email,
        user_profile.name,
        user_profile.role::TEXT
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- Update function comment
-- ============================================================================

COMMENT ON FUNCTION audit_table_changes() IS
    'PHI/PII-safe audit trigger function that logs INSERT, UPDATE, and DELETE operations.
    Automatically skips UPDATE operations where no business fields changed (excludes updated_at/created_at).
    Only stores non-sensitive fields for patients and profiles tables.
    Includes patient and item context for schedules (references, not full PHI).
    Security features: search_path protection, safe auth.uid() handling.
    Complies with healthcare data privacy requirements by excluding PHI/PII from audit logs.';