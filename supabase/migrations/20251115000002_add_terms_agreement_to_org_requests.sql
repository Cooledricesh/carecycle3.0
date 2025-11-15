-- Add terms agreement tracking columns to organization_requests table
-- These columns track when organization requesters agree to terms

BEGIN;

-- Add columns for tracking agreement timestamps
ALTER TABLE organization_requests
  ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_policy_agreed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN organization_requests.terms_agreed_at IS 'Timestamp when requester agreed to terms of service';
COMMENT ON COLUMN organization_requests.privacy_policy_agreed_at IS 'Timestamp when requester agreed to privacy policy';

COMMIT;
