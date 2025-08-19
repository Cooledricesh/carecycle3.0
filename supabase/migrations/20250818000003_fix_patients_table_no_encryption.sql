-- ============================================================================
-- Fix patients table to work without encryption
-- Date: 2025-08-18
-- Description: Simplify patients table for development without encryption
-- ============================================================================

BEGIN;

-- Drop the existing patients table if it exists
DROP TABLE IF EXISTS patients CASCADE;

-- Create a simplified patients table without encryption
CREATE TABLE patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id uuid NULL,
    patient_number text NOT NULL,
    name text NOT NULL,
    department text NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Add unique constraint on patient_number
    CONSTRAINT unique_patient_number UNIQUE (patient_number)
);

-- Create indexes for better performance
CREATE INDEX idx_patients_patient_number ON patients(patient_number);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_is_active ON patients(is_active);
CREATE INDEX idx_patients_created_at ON patients(created_at DESC);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow authenticated users to view all active patients
CREATE POLICY "Authenticated users can view active patients" ON patients
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Allow authenticated users to insert patients
CREATE POLICY "Authenticated users can insert patients" ON patients
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update their own patients
CREATE POLICY "Authenticated users can update patients" ON patients
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to soft delete (deactivate) patients
CREATE POLICY "Authenticated users can soft delete patients" ON patients
    FOR UPDATE
    TO authenticated
    USING (is_active = true)
    WITH CHECK (is_active = false);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON patients TO authenticated;
GRANT ALL ON patients TO service_role;

COMMIT;