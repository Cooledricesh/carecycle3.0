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

// Nurse can update care-related fields but not doctor assignment
const NurseUpdateSchema = BasePatientUpdateSchema.extend({
  careType: CareTypeEnum.nullable().optional(),
  department: z.string().max(50, '부서명은 50자 이내로 입력해주세요').nullable().optional(),
})

// Admin can update all fields including doctor assignment
const AdminUpdateSchema = BasePatientUpdateSchema.extend({
  doctorId: z.string().uuid('올바른 의사 ID를 선택해주세요').nullable().optional(),
  careType: CareTypeEnum.nullable().optional(),
  department: z.string().max(50, '부서명은 50자 이내로 입력해주세요').nullable().optional(),
})

// Doctor can only update limited fields (no doctor assignment or care type changes)
const DoctorUpdateSchema = BasePatientUpdateSchema

// Define strict whitelists for each role
const DOCTOR_ALLOWED_FIELDS = new Set(['name', 'patientNumber', 'isActive', 'metadata'])
const NURSE_ALLOWED_FIELDS = new Set([
  'name',
  'patientNumber',
  'isActive',
  'metadata',
  'careType',
  'department'
])
const ADMIN_ALLOWED_FIELDS = new Set([
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
  validatedData: z.infer<typeof AdminUpdateSchema>,
  userRole: string
) => {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  // Choose whitelist based on role
  let allowedFields: Set<string>
  switch (userRole) {
    case 'doctor':
      allowedFields = DOCTOR_ALLOWED_FIELDS
      break
    case 'nurse':
      allowedFields = NURSE_ALLOWED_FIELDS
      break
    case 'admin':
      allowedFields = ADMIN_ALLOWED_FIELDS
      break
    default:
      allowedFields = new Set()
  }

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

export async function PUT(
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

    // Check user role, care_type for nurses, and organization_id
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role, care_type, organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '사용자 정보를 확인할 수 없습니다' },
        { status: 403 }
      )
    }

    // Verify user has organization_id
    if (!profile.organization_id) {
      return NextResponse.json(
        { error: '조직 정보가 없습니다' },
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
    let schema: typeof DoctorUpdateSchema | typeof NurseUpdateSchema | typeof AdminUpdateSchema
    switch (profile.role) {
      case 'doctor':
        schema = DoctorUpdateSchema
        break
      case 'nurse':
        schema = NurseUpdateSchema
        break
      case 'admin':
        schema = AdminUpdateSchema
        break
      default:
        return NextResponse.json(
          { error: '권한이 없습니다' },
          { status: 403 }
        )
    }
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

    // Role-specific validation with organization check
    if (profile.role === 'doctor') {
      // Doctors can only update their assigned patients in same organization
      const { data: patient, error: patientError } = await userClient
        .from('patients')
        .select('doctor_id, organization_id')
        .eq('id', id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json(
          { error: '환자를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // Check if patient belongs to same organization
      if (patient.organization_id !== profile.organization_id) {
        return NextResponse.json(
          { error: '다른 조직의 환자는 수정할 수 없습니다' },
          { status: 403 }
        )
      }

      // Check if doctor is assigned to this patient
      if (patient.doctor_id !== user.id) {
        return NextResponse.json(
          { error: '담당 환자만 수정할 수 있습니다' },
          { status: 403 }
        )
      }
    } else if (profile.role === 'nurse') {
      // Nurses can only update patients in their care_type and organization
      // Using service client here to ensure we can read the patient even if RLS would block it
      const serviceClient = await createServiceClient()
      const { data: patient, error: patientError } = await serviceClient
        .from('patients')
        .select('care_type, organization_id')
        .eq('id', id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json(
          { error: '환자를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // Check if patient belongs to same organization
      if (patient.organization_id !== profile.organization_id) {
        return NextResponse.json(
          { error: '다른 조직의 환자는 수정할 수 없습니다' },
          { status: 403 }
        )
      }

      // Check if nurse's care_type matches patient's care_type
      if (patient.care_type !== profile.care_type) {
        return NextResponse.json(
          { error: '담당 진료 구분의 환자만 수정할 수 있습니다' },
          { status: 403 }
        )
      }
    } else if (profile.role === 'admin') {
      // Admins can update any patient in their organization
      const serviceClient = await createServiceClient()
      const { data: patient, error: patientError } = await serviceClient
        .from('patients')
        .select('organization_id')
        .eq('id', id)
        .single()

      if (patientError || !patient) {
        return NextResponse.json(
          { error: '환자를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // Check if patient belongs to same organization
      if (patient.organization_id !== profile.organization_id) {
        return NextResponse.json(
          { error: '다른 조직의 환자는 수정할 수 없습니다' },
          { status: 403 }
        )
      }
    }

    // Map validated fields to database columns using the secure mapping utility with role checking
    const updateData = mapValidatedFields(validationResult.data, profile.role)

    // Check if there are any actual changes to make
    // Remove updated_at to check if there are real field changes
    const { updated_at, ...actualChanges } = updateData
    if (Object.keys(actualChanges).length === 0) {
      // No actual changes, return early with success
      // Fetch current data to return
      const { data: currentPatient } = await userClient
        .from('patients')
        .select()
        .eq('id', id)
        .single()

      return NextResponse.json(
        currentPatient || { id, message: 'No changes to update' },
        { status: 200 }
      )
    }

    // First, try to update using the user's authenticated client (respects RLS)
    const { data, error } = await userClient
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Check if it's an RLS policy violation or ambiguous policy error
      const shouldUseFallback = error.code === '42501' || error.code === '42P17' || error.code === '42703'

      if (shouldUseFallback) {
        console.log(`[API] Database error (${error.code}), using function-based update fallback`)

        try {
          // Try using the secure function approach first
          // Convert snake_case updateData to camelCase for JSON
          const jsonUpdates: Record<string, any> = {}
          if ('name' in updateData) jsonUpdates.name = updateData.name
          if ('patient_number' in updateData) jsonUpdates.patient_number = updateData.patient_number
          if ('care_type' in updateData) jsonUpdates.care_type = updateData.care_type
          if ('department' in updateData) jsonUpdates.department = updateData.department
          if ('doctor_id' in updateData) jsonUpdates.doctor_id = updateData.doctor_id
          if ('is_active' in updateData) jsonUpdates.is_active = updateData.is_active
          if ('metadata' in updateData) jsonUpdates.metadata = updateData.metadata

          const { data: functionData, error: functionError } = await userClient
            .rpc('update_patient_with_role_check', {
              p_patient_id: id,
              p_updates: jsonUpdates
            })

          if (functionError) {
            console.log('[API] Function-based update failed, falling back to service client', functionError)

            // Last resort: use service client (bypasses RLS)
            const serviceClient = await createServiceClient()
            const { data: serviceData, error: serviceError } = await serviceClient
              .from('patients')
              .update(updateData)
              .eq('id', id)
              .select()
              .single()

            if (serviceError) {
              console.error('[API] Error updating patient with service client:', serviceError)
              return NextResponse.json(
                { error: `환자 정보 수정 실패: ${serviceError.message}` },
                { status: 400 }
              )
            }

            if (!serviceData) {
              return NextResponse.json({ error: '환자 정보를 찾을 수 없습니다' }, { status: 404 })
            }
            return NextResponse.json(serviceData)
          }

          // Function call succeeded
          if (!functionData) {
            return NextResponse.json({ error: '환자 정보를 찾을 수 없습니다' }, { status: 404 })
          }
          return NextResponse.json(functionData)

        } catch (fallbackError) {
          console.error('[API] Fallback failed:', fallbackError)

          // Last attempt with service client
          const serviceClient = await createServiceClient()
          const { data: serviceData, error: serviceError } = await serviceClient
            .from('patients')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

          if (serviceError) {
            console.error('[API] Final service client attempt failed:', serviceError)
            return NextResponse.json(
              { error: `환자 정보 수정 실패: ${serviceError.message}` },
              { status: 400 }
            )
          }

          if (!serviceData) {
            return NextResponse.json({ error: '환자 정보를 찾을 수 없습니다' }, { status: 404 })
          }
          return NextResponse.json(serviceData)
        }
      } else {
        // Other database error
        console.error('[API] Error updating patient:', error)
        return NextResponse.json(
          { error: `환자 정보 수정 실패: ${error.message}` },
          { status: 400 }
        )
      }
    }

    // Ensure we always return valid JSON
    if (!data) {
      return NextResponse.json({ error: '환자 정보를 찾을 수 없습니다' }, { status: 404 })
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