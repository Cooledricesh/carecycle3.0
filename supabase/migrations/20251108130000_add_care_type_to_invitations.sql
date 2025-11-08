-- Migration: Add care_type field to invitations table
-- Purpose: Support nurse role invitations with care type assignment
-- Date: 2025-01-08

BEGIN;

-- Add care_type column to invitations table
-- This field is required for nurse role invitations
-- Valid values: '외래', '입원', '낮병원'
-- NULL for admin/doctor roles
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS care_type text;

-- Add comment
COMMENT ON COLUMN public.invitations.care_type IS 'Care type for nurse invitations (외래/입원/낮병원), NULL for admin/doctor roles';

-- Add check constraint to ensure care_type is valid when provided
ALTER TABLE public.invitations
ADD CONSTRAINT check_invitation_care_type
CHECK (
  care_type IS NULL
  OR care_type IN ('외래', '입원', '낮병원')
);

-- Backfill existing nurse invitations with default care_type
-- This prevents constraint violation when adding the nurse care_type check
UPDATE public.invitations
SET care_type = '외래'
WHERE role = 'nurse' AND care_type IS NULL;

-- Add check constraint to ensure nurse invitations have care_type
ALTER TABLE public.invitations
ADD CONSTRAINT check_nurse_care_type
CHECK (
  (role = 'nurse' AND care_type IS NOT NULL)
  OR (role IN ('admin', 'doctor', 'super_admin') AND care_type IS NULL)
);

COMMIT;
