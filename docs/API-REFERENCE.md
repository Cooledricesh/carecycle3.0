# Medical Scheduling System - API Reference

## Overview

The Medical Scheduling System API provides a comprehensive interface for managing patient medical schedules, automating recurring tests and injections for hospital nurses. This RESTful API is built with Next.js 15, TypeScript, and Supabase.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.medical-scheduler.com
```

## Authentication

All API endpoints require authentication using Supabase's new API key system with client and service-level access.

### Key Types

- **Publishable Key**: Used for client-side operations, browser-safe
- **Secret Key**: Used for server-side admin operations, never exposed to the client

### Obtaining Access Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "staff@hospital.com",
  "password": "SecurePassword123!"
}
```

### Authentication Flow

1. Client creates Supabase client using publishable key
2. Server creates authenticated client using user's session
3. Admin operations use service client with secret key

### Server-Side Authentication Helpers

```typescript
// User-level operations
const supabase = await createClient()

// Admin-only operations
const adminSupabase = await createServiceClient()

// Check current user
const user = await getCurrentUser()

// Require admin access
await requireAdmin()
```

### Session Management

- Sessions managed via secure, HTTP-only cookies
- Automatic session refresh using Supabase SSR
- Explicit session invalidation on logout

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error context
  }
}
```

### Common Error Codes

| Code | Description | Possible Scenario |
|------|-------------|-------------------|
| `AUTH_REQUIRED` | Authentication token missing or invalid | Missing or expired token |
| `RESOURCE_NOT_FOUND` | Requested resource does not exist | Invalid patient ID |
| `VALIDATION_ERROR` | Input validation failed | Invalid patient data |
| `DUPLICATE_ENTRY` | Unique constraint violation | Duplicate patient number |
| `PERMISSION_DENIED` | Insufficient permissions | Role-based access restriction |
| `PGRST116` | Supabase: Resource not found | Non-existent database record |
| `42501` | Supabase: Row-level security violation | Attempt to access unauthorized data |
| `ROLE_RESTRICTED` | Role-specific update constraint | Doctor updating non-assigned patient |

### RLS (Row Level Security) Error Handling

When Row Level Security prevents an operation, the system provides a robust fallback mechanism:

1. **Direct RLS Violation (42501)**
   - First attempt: Direct Supabase update
   - If blocked by RLS, trigger service-layer validation

2. **Fallback Mechanism**
   ```typescript
   try {
     // Direct Supabase update
     const { data, error } = await supabase
       .from('patients')
       .update(updateData)
       .eq('id', patientId);

     if (error && error.code === '42501') {
       // RLS Violation: Use service-layer validation
       const result = await patientService.updatePatient(
         patientId,
         updateData,
         currentUser
       );
     }
   } catch (error) {
     // Handle fallback errors
   }
   ```

## Rate Limiting

- **Default limit**: 100 requests per minute per user
- **Bulk operations**: 10 requests per minute
- Returns `429 Too Many Requests` when exceeded

## Endpoints

### Authentication

[Previous authentication sections remain the same]

### Patients

#### List Patients

[Previous implementation remains the same]

#### Create Patient

[Previous implementation remains the same]

#### Get Patient Details

[Previous implementation remains the same]

#### Update Patient (Enhanced)

Update patient information with role-based access control.

```http
PUT /patients/{id}/update
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Role-Based Update Permissions:**

- **Doctors**:
  - Can only update patients assigned to them (`doctor_id`)
  - Limited fields: `metadata`, `notes`

- **Nurses**:
  - Can update `careType`
  - Update patients within their care type

- **Admins**:
  - Full update permissions
  - Can modify all patient fields

**Request Body:**
```json
{
  "name": "John Doe Jr.",
  "patientNumber": "P12345",
  "doctorId": "doctor-uuid",
  "careType": "Chemotherapy",
  "isActive": true,
  "metadata": {
    "roomNumber": "205B",
    "specialNotes": "Requires special care"
  }
}
```

**Allowed Fields by Role:**

| Field | Doctor | Nurse | Admin |
|-------|--------|-------|-------|
| `name` | ❌ | ❌ | ✅ |
| `patientNumber` | ❌ | ❌ | ✅ |
| `doctorId` | ❌ | ❌ | ✅ |
| `careType` | ❌ | ✅ | ✅ |
| `isActive` | ❌ | ❌ | ✅ |
| `metadata` | ✅ | ✅ | ✅ |

**Response Scenarios:**

1. **Successful Update**: `200 OK`
   ```json
   {
     "id": "patient-uuid",
     "name": "John Doe Jr.",
     "updatedFields": ["careType"],
     "message": "Patient updated successfully"
   }
   ```

2. **Role Restriction**: `403 Forbidden`
   ```json
   {
     "error": "ROLE_RESTRICTED",
     "message": "You do not have permission to update this patient",
     "allowedFields": ["metadata"]
   }
   ```

3. **RLS Violation**: `403 Forbidden`
   ```json
   {
     "error": "PERMISSION_DENIED",
     "message": "Cannot update patient outside your assigned scope",
     "code": "42501"
   }
   ```

#### Delete Patient (Soft Delete)

[Previous implementation remains the same]

[Rest of the document remains unchanged]