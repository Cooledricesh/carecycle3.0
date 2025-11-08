-- Add CHECK constraint for audit_logs.operation field
-- Ensures data integrity by restricting operation values to valid SQL operations
-- Valid values: INSERT, UPDATE, DELETE

BEGIN;

-- Add CHECK constraint to enforce valid operation values
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_operation_check
CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'));

COMMENT ON CONSTRAINT audit_logs_operation_check ON public.audit_logs IS
    'Enforces that operation field only contains valid SQL operation types: INSERT, UPDATE, or DELETE.
    This ensures data integrity and prevents invalid operation values in audit logs.';

COMMIT;
