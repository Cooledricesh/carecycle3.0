-- Add user_name column to audit_logs table to store username at action time
-- This prevents "알 수 없음" (Unknown) display when users are deleted

BEGIN;

-- Add user_name column to audit_logs table
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_name
ON audit_logs(user_name);

-- Update existing audit trigger to capture username
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_old_data json;
  v_new_data json;
  v_user_id uuid;
  v_user_email text;
  v_user_role text;
  v_user_name text;  -- Add user name variable
BEGIN
  -- Get user information from auth context
  v_user_id := auth.uid();
  v_user_email := current_setting('request.jwt.claims', true)::json->>'email';
  v_user_role := current_setting('request.jwt.claims', true)::json->>'user_metadata'->>'role';

  -- Get user name from profiles table if user is authenticated
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name
    FROM profiles
    WHERE id = v_user_id
    LIMIT 1;
  END IF;

  -- Handle different operations
  IF TG_OP = 'UPDATE' THEN
    v_old_data := to_json(OLD);
    v_new_data := to_json(NEW);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      NEW.id,
      v_old_data,
      v_new_data,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_json(OLD);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      OLD.id,
      v_old_data,
      NULL,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );

  ELSIF TG_OP = 'INSERT' THEN
    v_new_data := to_json(NEW);

    INSERT INTO audit_logs (
      table_name,
      operation,
      record_id,
      old_values,
      new_values,
      user_id,
      user_email,
      user_role,
      user_name,  -- Include user name
      timestamp,
      ip_address,
      user_agent
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      NEW.id,
      NULL,
      v_new_data,
      v_user_id,
      v_user_email,
      v_user_role,
      v_user_name,  -- Include user name value
      NOW(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing audit logs with usernames from profiles table
UPDATE audit_logs al
SET user_name = p.name
FROM profiles p
WHERE al.user_id = p.id
  AND al.user_name IS NULL
  AND p.name IS NOT NULL;

-- For audit logs without user_id (system operations), set appropriate name
UPDATE audit_logs
SET user_name = 'System'
WHERE user_id IS NULL
  AND user_name IS NULL;

COMMIT;

-- Add comment to document the column
COMMENT ON COLUMN audit_logs.user_name IS 'Username captured at the time of the action to preserve historical context even if user is deleted';