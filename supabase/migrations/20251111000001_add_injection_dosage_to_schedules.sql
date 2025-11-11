-- Migration: Add injection_dosage field to schedules table and migrate data from notes
-- Created: 2025-11-11
-- Purpose: Separate injection dosage from notes field for better data structure

BEGIN;

-- Step 1: Add injection_dosage column to schedules table
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS injection_dosage numeric;

COMMENT ON COLUMN schedules.injection_dosage IS 'Injection dosage amount (e.g., 100, 150, 300, 400, 525, 700, 1000)';

-- Step 2: Extract dosage from notes and populate injection_dosage
-- Pattern matches: "기본 용량: XXXmg" or "용량: XXXmg" or just numbers followed by mg
UPDATE schedules s
SET injection_dosage = (
  SELECT
    CASE
      -- Extract number from "기본 용량: 150mg" pattern
      WHEN s.notes ~* '기본\s*용량\s*:\s*([0-9]+)\s*mg' THEN
        (regexp_match(s.notes, '기본\s*용량\s*:\s*([0-9]+)\s*mg', 'i'))[1]::numeric
      -- Extract number from "용량: 150mg" pattern
      WHEN s.notes ~* '용량\s*:\s*([0-9]+)\s*mg' THEN
        (regexp_match(s.notes, '용량\s*:\s*([0-9]+)\s*mg', 'i'))[1]::numeric
      -- Extract just numbers followed by mg
      WHEN s.notes ~* '([0-9]+)\s*mg' THEN
        (regexp_match(s.notes, '([0-9]+)\s*mg', 'i'))[1]::numeric
      ELSE NULL
    END
)
WHERE s.item_id IN (
  SELECT id FROM items WHERE category = 'injection'
)
AND s.notes IS NOT NULL
AND s.notes != '';

-- Step 3: Clean up notes by removing the dosage information
UPDATE schedules s
SET notes =
  CASE
    -- Remove "[주사 정보]\n기본 용량: XXXmg" block
    WHEN s.notes ~* '\[주사\s*정보\][^\n]*\n기본\s*용량\s*:\s*[0-9]+\s*mg' THEN
      regexp_replace(
        regexp_replace(s.notes, '\[주사\s*정보\][^\n]*\n기본\s*용량\s*:\s*[0-9]+\s*mg', '', 'gi'),
        '\n\n+', E'\n\n', 'g'  -- Remove multiple consecutive newlines
      )
    -- Remove standalone "기본 용량: XXXmg" or "용량: XXXmg"
    WHEN s.notes ~* '기본\s*용량\s*:\s*[0-9]+\s*mg' THEN
      regexp_replace(
        regexp_replace(s.notes, '기본\s*용량\s*:\s*[0-9]+\s*mg', '', 'gi'),
        '\n\n+', E'\n\n', 'g'
      )
    WHEN s.notes ~* '용량\s*:\s*[0-9]+\s*mg' THEN
      regexp_replace(
        regexp_replace(s.notes, '용량\s*:\s*[0-9]+\s*mg', '', 'gi'),
        '\n\n+', E'\n\n', 'g'
      )
    ELSE s.notes
  END
WHERE s.item_id IN (
  SELECT id FROM items WHERE category = 'injection'
)
AND s.injection_dosage IS NOT NULL;

-- Step 4: Trim leading/trailing whitespace and newlines from notes
UPDATE schedules
SET notes = TRIM(BOTH E'\n' FROM TRIM(notes))
WHERE notes IS NOT NULL
AND notes != '';

-- Step 5: Set empty notes to NULL
UPDATE schedules
SET notes = NULL
WHERE notes IS NOT NULL
AND TRIM(notes) = '';

COMMIT;

-- Verification queries (commented out, run manually to verify)
-- SELECT
--   s.id,
--   s.injection_dosage,
--   s.notes,
--   i.name as item_name,
--   p.name as patient_name
-- FROM schedules s
-- JOIN items i ON s.item_id = i.id
-- JOIN patients p ON s.patient_id = p.id
-- WHERE i.category = 'injection'
-- ORDER BY s.created_at DESC;
