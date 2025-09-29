# Medical Scheduling System - API Reference

**Version**: 1.2.0
**Last Updated**: September 30, 2025

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
  - Limited fields: `metadata`

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
  "careType": "외래",
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

#### Assign Doctor to Patient (Flexible Assignment)

Assign a doctor to a patient either by ID (registered doctor) or by name (pre-registration).

```http
PATCH /patients/{id}/assign-doctor
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  // Option 1: Assign registered doctor
  "doctorId": "doctor-uuid",

  // Option 2: Assign by name (pre-registration)
  "assignedDoctorName": "Dr. Kim"
}
```

**Notes:**
- Only one field should be provided (`doctorId` OR `assignedDoctorName`)
- If `doctorId` is provided, `assignedDoctorName` is cleared
- If `assignedDoctorName` is provided, `doctorId` is cleared
- When a doctor with matching name registers, patients are auto-linked

**Response:**
```json
{
  "id": "patient-uuid",
  "doctorId": "doctor-uuid",
  "assignedDoctorName": null,
  "doctorDisplayName": "Dr. Kim",
  "doctorStatus": "registered" // or "pending" or "unassigned"
}
```

### Items

#### List Items

Get all medical items with optional filtering.

```http
GET /items
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
- `category`: Filter by category (`injection`, `test`, `other`)
- `isActive`: Filter by active status
- `requiresNotification`: Filter by notification requirement
- `searchTerm`: Search in code and name

**Response:**
```json
[
  {
    "id": "item-uuid",
    "code": "INJ001",
    "name": "Insulin Injection",
    "category": "injection",
    "defaultIntervalWeeks": 4,
    "description": "Regular insulin administration",
    "requiresNotification": true,
    "notificationDaysBefore": 7,
    "isActive": true
  }
]
```

#### Create Item

Create a new medical item with validation.

```http
POST /items
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body Schema (Zod Validated):**
```json
{
  "code": "INJ002",              // Required: [A-Z0-9]+ pattern, max 20 chars
  "name": "Item Name",           // Required: max 100 chars
  "category": "injection",       // Required: injection|test|other
  "defaultIntervalWeeks": 4,     // Required: 1-52
  "description": "Description",  // Optional: max 500 chars
  "instructions": "Instructions",// Optional: max 1000 chars
  "preparationNotes": "Notes",   // Optional: max 500 chars
  "requiresNotification": false, // Optional: default false
  "notificationDaysBefore": 7,   // Optional: 0-30, default 7
  "isActive": true,              // Optional: default true
  "sortOrder": 0                 // Optional: min 0, default 0
}
```

**Validation Rules:**
- `code`: Uppercase letters and numbers only
- `category`: Limited to 3 values (simplified from 5)
- `defaultIntervalWeeks`: Integer between 1-52
- All text fields have length limits

#### Bulk Update Items

Update multiple items at once.

```http
PATCH /items/bulk
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "itemIds": ["item-uuid-1", "item-uuid-2"],
  "updates": {
    "category": "other",
    "requiresNotification": true
  }
}
```

### Database Views

#### Patient Doctor View

Get unified patient-doctor assignment information.

```http
GET /views/patient-doctor
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:**
```json
[
  {
    "id": "patient-uuid",
    "patientName": "John Doe",
    "patientNumber": "P12345",
    "doctorDisplayName": "Dr. Kim",
    "doctorStatus": "registered", // registered|pending|unassigned
    "doctorEmail": "dr.kim@hospital.com",
    "careType": "외래"
  }
]
```

#### Pending Doctors

Get list of doctor names that need registration.

```http
GET /doctors/pending
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:**
```json
[
  {
    "name": "Dr. Park",
    "patientCount": 5
  },
  {
    "name": "Dr. Lee",
    "patientCount": 3
  }
]
```

## Change Log

### Version 1.2.0 (September 30, 2025)

#### New Features
- **Flexible Doctor Assignment**: Support for assigning doctors by name before registration
- **Auto-linking System**: Automatic patient-doctor linking when doctors register
- **Simplified Item Categories**: Reduced from 5 to 3 categories (injection, test, other)
- **Enhanced Item Validation**: Strict Zod schemas for all item operations
- **Bulk Item Operations**: Ability to update multiple items simultaneously

#### New Endpoints
- `PATCH /patients/{id}/assign-doctor`: Flexible doctor assignment
- `GET /views/patient-doctor`: Unified patient-doctor view
- `GET /doctors/pending`: List of pending doctor registrations
- `POST /items`: Create item with enhanced validation
- `PATCH /items/bulk`: Bulk update items

#### Database Changes
- Added `assigned_doctor_name` column to patients table
- Created `patient_doctor_view` for unified assignment tracking
- Added `auto_link_doctor_on_signup()` function
- Simplified item category constraint to 3 values

#### Breaking Changes
- Item categories `treatment` and `medication` no longer valid (use `other` instead)

### Version 1.1.0 (September 22, 2025)
- Initial stable release with core scheduling features
- User approval system implementation
- Patient archiving functionality
- Schedule pause/resume system

### Version 1.0.0 (August 2025)
- MVP release