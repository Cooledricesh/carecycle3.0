-- Add care_type column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS care_type TEXT CHECK (care_type IN ('외래', '입원', '낮병원'));

-- Create index for care_type for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_care_type ON patients(care_type);

-- Comment on the new column
COMMENT ON COLUMN patients.care_type IS '진료구분: 외래, 입원, 낮병원 중 하나';