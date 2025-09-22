import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Define care type enum locally to avoid import issues
const CareTypeEnum = z.enum(['외래', '입원', '낮병원'])

// Define strict validation schemas for patient updates
const BasePatientUpdateSchema = z.object({
  name: z
    .string()
    .min(1, '환자명을 입력해주세요')
    .max(100, '환자명은 100자 이내로 입력해주세요')
    .regex(/^[가-힣a-zA-Z\s]+$/, '환자명은 한글, 영문, 공백만 입력 가능합니다')
    .optional(),

  patientNumber: z
    .string()
    .min(1, '환자번호를 입력해주세요')
    .max(50, '환자번호는 50자 이내로 입력해주세요')
    .regex(/^[A-Z0-9]{1,50}$/, '환자번호는 영문 대문자와 숫자만 입력 가능합니다')
    .optional(),

  isActive: z.boolean().optional(),

  metadata: z
    .record(z.string(), z.unknown())
    .refine((meta) => {
      // Ensure metadata doesn't contain potentially dangerous keys
      const dangerousKeys = ['__proto__', 'constructor', 'prototype']
      return !Object.keys(meta).some(key => dangerousKeys.includes(key))
    }, 'Metadata contains invalid keys')
    .optional(),
})

// Nurse/Admin can update all fields
const NurseAdminUpdateSchema = BasePatientUpdateSchema.extend({
  doctorId: z.string().uuid('올바른 의사 ID를 선택해주세요').nullable().optional(),
  careType: CareTypeEnum.nullable().optional(),
  department: z.string().max(50, '부서명은 50자 이내로 입력해주세요').nullable().optional(),
})

// Doctor can only update limited fields (no doctor assignment or care type changes)
const DoctorUpdateSchema = BasePatientUpdateSchema

// Define strict whitelists for each role
const DOCTOR_ALLOWED_FIELDS = new Set(['name', 'patientNumber', 'isActive', 'metadata'])
const NURSE_ADMIN_ALLOWED_FIELDS = new Set([
  'name',
  'patientNumber',
  'isActive',
  'metadata',
  'doctorId',
  'careType',
  'department'
])

// Type-safe field mapping utility with role-based filtering
const mapValidatedFields = (
  validatedData: z.infer<typeof NurseAdminUpdateSchema>,
  userRole: string
) => {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  // Choose whitelist based on role
  const allowedFields = userRole === 'doctor'
    ? DOCTOR_ALLOWED_FIELDS
    : NURSE_ADMIN_ALLOWED_FIELDS

  // Map validated fields with explicit type checking and role-based filtering
  const fieldMappings: Record<string, string> = {
    doctorId: 'doctor_id',
    careType: 'care_type',
    department: 'department',
    name: 'name',
    patientNumber: 'patient_number',
    isActive: 'is_active',
    metadata: 'metadata'
  }

  for (const [camelCase, snakeCase] of Object.entries(fieldMappings)) {
    // Critical security check: Only process fields that are explicitly allowed for this role
    if (!allowedFields.has(camelCase)) {
      continue // Skip fields not in whitelist
    }

    if (camelCase in validatedData) {
      const value = validatedData[camelCase as keyof typeof validatedData]
      if (value !== undefined) {
        // Additional role-based validation for sensitive fields
        if (userRole === 'doctor') {
          // Double-check that doctors cannot update restricted fields
          if (['doctorId', 'careType', 'department'].includes(camelCase)) {
            console.warn(`[SECURITY] Doctor attempted to update restricted field: ${camelCase}`)
            continue // Skip this field entirely
          }
        }
        updateData[snakeCase] = value
      }
    }
  }

  return updateData
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await request.json()

    // First verify the user is authenticated and has permission
    const userClient = await createClient()
    const { data: { user }, error: authError } = await userClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    // Check user role
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '사용자 정보를 확인할 수 없습니다' },
        { status: 403 }
      )
    }

    // Only nurses and admins can update patient information
    // Doctors can only update certain fields for their assigned patients
    const allowedRoles = ['nurse', 'admin', 'doctor']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: '환자 정보 수정 권한이 없습니다' },
        { status: 403 }
      )
    }

    // Validate input based on user role
    const schema = profile.role === 'doctor' ? DoctorUpdateSchema : NurseAdminUpdateSchema
    const validationResult = schema.safeParse(updates)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '입력 데이터가 유효하지 않습니다',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      )
    }

    // If user is a doctor, verify they're assigned to this patient
    if (profile.role === 'doctor') {
      const { data: patient, error: patientError } = await userClient
        .from('patients')
        .select('doctor_id')
        .eq('id', id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json(
          { error: '환자를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // Check if doctor is assigned to this patient
      if (patient.doctor_id !== user.id) {
        return NextResponse.json(
          { error: '담당 환자만 수정할 수 있습니다' },
          { status: 403 }
        )
      }
    }

    // Use service client to bypass RLS for the update
    const serviceClient = await createServiceClient()

    // Map validated fields to database columns using the secure mapping utility with role checking
    const updateData = mapValidatedFields(validationResult.data, profile.role)

    // Update the patient
    const { data, error } = await serviceClient
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating patient:', error)
      return NextResponse.json(
        { error: `환자 정보 수정 실패: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}