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

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token missing or invalid |
| `RESOURCE_NOT_FOUND` | Requested resource does not exist |
| `VALIDATION_ERROR` | Input validation failed |
| `DUPLICATE_ENTRY` | Unique constraint violation |
| `PERMISSION_DENIED` | Insufficient permissions |
| `PGRST116` | Supabase: Resource not found |
| `42501` | Supabase: Row-level security violation |

## Rate Limiting

- **Default limit**: 100 requests per minute per user
- **Bulk operations**: 10 requests per minute
- Returns `429 Too Many Requests` when exceeded

## Endpoints

### Authentication

#### Login

Authenticate a user and obtain access tokens.

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "staff@hospital.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "staff@hospital.com",
    "name": "Jane Nurse",
    "role": "nurse"
  },
  "session": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  }
}
```

#### Logout

End the current session.

```http
POST /auth/logout
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Successfully logged out"
}
```

### Patients

#### List Patients

Retrieve all active patients with optional filtering.

```http
GET /patients?search=john&department=oncology&limit=20&offset=0
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search by name or patient number |
| department | string | Filter by department |
| careType | string | Filter by care type |
| isActive | boolean | Filter by active status |
| limit | integer | Results per page (max: 100) |
| offset | integer | Number of results to skip |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "patientNumber": "P12345",
      "department": "Oncology",
      "careType": "Chemotherapy",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Create Patient

Register a new patient.

```http
POST /patients
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "patientNumber": "P67890",
  "department": "Cardiology",
  "careType": "Post-Surgery Monitoring",
  "metadata": {
    "roomNumber": "301A",
    "primaryDoctor": "Dr. Johnson"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Jane Smith",
  "patientNumber": "P67890",
  "department": "Cardiology",
  "careType": "Post-Surgery Monitoring",
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### Get Patient Details

Retrieve detailed information about a specific patient.

```http
GET /patients/{id}
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "patientNumber": "P12345",
  "department": "Oncology",
  "careType": "Chemotherapy",
  "isActive": true,
  "metadata": {
    "roomNumber": "205B"
  },
  "schedules": [
    // Array of patient's schedules
  ],
  "recentActivities": [
    // Array of recent activities
  ]
}
```

#### Update Patient

Update patient information.

```http
PUT /patients/{id}
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe Jr.",
  "department": "Pediatric Oncology",
  "careType": "Modified Treatment Plan"
}
```

**Response:** `200 OK`

#### Delete Patient (Soft Delete)

Mark a patient as inactive.

```http
DELETE /patients/{id}
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `204 No Content`

### Schedules

#### List Schedules

Retrieve schedules with filtering options.

```http
GET /schedules?type=today&status=active
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | `today`, `upcoming`, `overdue`, `all` |
| patientId | uuid | Filter by patient |
| status | string | `active`, `completed`, `cancelled` |
| daysAhead | integer | Days to look ahead (1-90, default: 7) |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "patientId": "uuid",
    "itemName": "Blood Test",
    "intervalType": "weekly",
    "intervalDays": 7,
    "nextDueDate": "2025-01-08",
    "status": "active",
    "priority": "high"
  }
]
```

#### Create Schedule

Create a new medical schedule.

```http
POST /schedules
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "patientId": "uuid",
  "itemId": "uuid",
  "intervalType": "weekly",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "priority": "medium",
  "notes": "Monitor blood glucose levels"
}
```

**Response:** `201 Created`

#### Mark Schedule as Completed

Complete a schedule and optionally create the next occurrence.

```http
POST /schedules/{id}/complete
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "executedDate": "2025-01-01T10:00:00Z",
  "executedBy": "nurse-uuid",
  "notes": "Normal values observed",
  "createNext": true
}
```

**Response:** `200 OK`
```json
{
  "completedSchedule": {
    // Completed schedule details
  },
  "nextSchedule": {
    // Next occurrence details
  }
}
```

### Dashboard

#### Get Dashboard Statistics

Retrieve comprehensive dashboard metrics.

```http
GET /dashboard/stats
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `200 OK`
```json
{
  "totalPatients": 150,
  "activePatients": 120,
  "todaySchedules": 45,
  "overdueSchedules": 5,
  "upcomingSchedules": 230,
  "completionRate": 0.92,
  "recentActivities": [
    {
      "id": "uuid",
      "type": "schedule_completed",
      "description": "Blood test completed for John Doe",
      "timestamp": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Medical Items

#### List Medical Items

Retrieve available medical items and procedures.

```http
GET /items?category=Laboratory%20Test&search=blood
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| search | string | Search by item name |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Complete Blood Count",
    "category": "Laboratory Test",
    "description": "Comprehensive blood analysis",
    "defaultInterval": 7,
    "isActive": true
  }
]
```

## Server Actions

Server Actions provide a secure, type-safe method for performing sensitive server-side mutations directly from client components.

### Key Features

- Type-safe server mutations
- Built-in authentication and authorization
- Direct integration with client components
- Automatic error handling

### Delete Item Action Example

```typescript
// src/app/actions/items.ts
export async function deleteItemAction(id: string) {
  // Server-side validation and deletion logic
  // Checks for execution history
  // Ensures admin-only access
  const result = await deleteItem(id);
  return result;
}

// Client-side usage
const handleDelete = async () => {
  try {
    const result = await deleteItemAction(itemId);
    if (result.success) {
      // Handle successful deletion
    } else {
      // Handle deletion errors
      alert(result.error || "삭제할 수 없습니다");
    }
  } catch (error) {
    // Handle server action errors
  }
}
```

### Constraints and Validation

- Deletion blocked if item has medical execution history
- Admin role required
- Cascading deletion of related schedules and notifications

## Real-time Architecture

### Event Manager (`/src/lib/realtime/event-manager.ts`)

- Centralized event bus for all system updates
- Table-specific subscriptions
- Connection state monitoring

#### Event Subscription Example

```typescript
// Subscribe to patient updates
eventManager.subscribeToTable('patients', (event) => {
  switch (event.type) {
    case 'INSERT': handlePatientCreated(event.data); break;
    case 'UPDATE': handlePatientUpdated(event.data); break;
    case 'DELETE': handlePatientDeleted(event.data); break;
  }
});
```

### Connection Manager (`/src/lib/realtime/connection-manager.ts`)

- Single WebSocket connection point
- Automatic reconnection with exponential backoff
- Connection health monitoring

#### Optimistic Updates Pattern

```typescript
const onMutate = async (newData) => {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, (oldData) => {
    // Optimistically update UI
    return { ...oldData, ...newData };
  });
  return { previousData };
};

const onError = (error, variables, context) => {
  // Rollback to previous state if mutation fails
  queryClient.setQueryData(queryKey, context.previousData);
};
```

### Fallback Polling Strategy

- Connected state: 30-60 second polling interval
- Disconnected state: 3-5 second polling for critical data updates

## Performance Monitoring

### Dashboard Metrics

- **Cache Hit Rate**: Target > 70%
- **Query Time**: Target < 500ms
- **Connection Uptime**: Target > 90%
- **Error Rate**: Target < 5%

### Custom Metrics Recording

```typescript
// Performance tracking utility
performanceMonitor.recordMetric({
  name: 'database_query_time',
  value: queryExecutionTime,
  tags: ['patients', 'read']
});
```

### WebSocket Real-time Updates

The system supports real-time updates via WebSocket connections.

#### Connection

```javascript
const ws = new WebSocket('wss://api.medical-scheduler.com/realtime');
```

#### Event Types

| Event | Description |
|-------|-------------|
| `patient.created` | New patient added |
| `patient.updated` | Patient information changed |
| `patient.deleted` | Patient marked as inactive |
| `schedule.created` | New schedule created |
| `schedule.completed` | Schedule marked as completed |
| `schedule.overdue` | Schedule became overdue |

#### Message Format

```json
{
  "event": "schedule.completed",
  "data": {
    // Event-specific data
  },
  "timestamp": "2025-01-01T10:00:00Z"
}
```

## Best Practices

### Pagination

Always use pagination for list endpoints to avoid performance issues:

```http
GET /patients?limit=20&offset=40
```

### Error Handling

Implement exponential backoff for retries:

```javascript
const backoff = (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000);
```

### Caching

Use ETags for conditional requests:

```http
GET /patients/{id}
If-None-Match: "etag-value"
```

### Batch Operations

For bulk operations, use dedicated batch endpoints when available:

```http
POST /schedules/batch
Content-Type: application/json

{
  "schedules": [
    // Array of schedules to create
  ]
}
```

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
// Client-side user operations
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Fetch patients with type-safe queries
const { data, error } = await supabase
  .from('patients')
  .select('*')
  .eq('isActive', true)
  .limit(20);

// Server-side admin operations
import { createServiceClient } from '@/lib/supabase/server';

const adminSupabase = await createServiceClient();

// Bypasses RLS for admin tasks
const { data, error } = await adminSupabase
  .from('patients')
  .update({ status: 'archived' })
  .eq('id', patientId);
```

### Key Security Practices

- **Never expose secret key in client code**
- Use environment-specific client creation
- Implement Row Level Security (RLS)
- Validate all user inputs

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@hospital.com","password":"password"}'

# Get patients
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Postman

Import the provided Postman collection and environment files:
- `medical-scheduler.postman_collection.json`
- `medical-scheduler.postman_environment.json`

## Support

For API support and questions:
- Documentation: `/api-docs` (Swagger UI)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Email: support@medical-scheduler.com

## Error Codes

### New Error Scenarios

| Code | Description | Example Scenario |
|------|-------------|------------------|
| `EXECUTION_HISTORY_EXISTS` | Cannot delete item with medical records | Attempting to delete an item with active schedules |
| `ADMIN_REQUIRED` | Operation requires admin privileges | Non-admin trying to perform admin actions |
| `CONNECTION_LOST` | Real-time connection interrupted | WebSocket disconnection during live update |
| `OPTIMISTIC_UPDATE_FAILED` | Rollback triggered | Database mutation fails after optimistic update |
| `SCHEDULE_CONSTRAINT_VIOLATION` | Schedule creation blocked | Conflicting schedule or policy violation |

## Migration Guide: v1.0 to v1.1

### Authentication System Changes
- Replace legacy JWT tokens with new publishable/secret keys
- Update Supabase client initialization
- Modify authentication middleware

### Server Actions Adoption
- Migrate traditional API endpoints to Server Actions
- Implement type-safe mutations
- Add enhanced authorization checks

### Real-time Subscription Updates
- Use new event manager for table subscriptions
- Implement fallback polling strategies
- Update connection management logic

### Database Schema Changes
- Added cascade deletion constraints
- Enhanced Row Level Security policies
- Introduced more granular role-based access control

## Changelog

### Version 1.1.0 (Current)
- Migrated to new Supabase API key system
- Enhanced server-side authentication with separate clients
- Improved type safety with generated database types
- Implemented stricter Row Level Security (RLS)
- Added server actions for more secure mutations
- Improved error handling and validation
- Comprehensive real-time architecture
- Advanced performance monitoring

#### Breaking Changes
- Removed legacy JWT token authentication
- Require separate publishable and secret keys
- Updated client initialization methods
- Server Actions replace traditional REST endpoints
- Enhanced real-time connection management

### Version 1.0.0
- Initial API release
- Patient management endpoints
- Schedule automation
- Real-time updates
- Dashboard analytics