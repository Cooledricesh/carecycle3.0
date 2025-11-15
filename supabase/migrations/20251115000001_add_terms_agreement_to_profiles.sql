-- Add terms agreement tracking columns to profiles table
-- These columns track when users agree to terms of service and privacy policy
-- NULL values indicate users who existed before this feature (no retroactive enforcement)

BEGIN;

-- Add columns for tracking agreement timestamps
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_policy_agreed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.terms_agreed_at IS 'Timestamp when user agreed to terms of service';
COMMENT ON COLUMN profiles.privacy_policy_agreed_at IS 'Timestamp when user agreed to privacy policy';

COMMIT;
