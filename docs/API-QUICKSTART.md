# API Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites

- Node.js 18+ installed
- Supabase account (free tier available)
- Postman or similar API testing tool (optional)

### 1. Environment Setup

Create a `.env.local` file in the project root:

```env
# ✅ NEW SYSTEM: Required environment variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
```

> **⚠️ Important:** This project uses Supabase's new API key system (publishable/secret keys) instead of the legacy anon/service_role JWT tokens. The publishable key is safe for browser use, while the secret key is for server-side operations only.

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

### 4. Access Interactive Documentation

Open your browser and navigate to:
```
http://localhost:3000/api-docs
```

This provides an interactive Swagger UI where you can test all endpoints.

## 🔑 Authentication Flow

### Step 1: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Response:**
```json
{
  "session": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Step 2: Use the Token

Include the token in all subsequent requests:

```bash
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📝 Common Use Cases

### Update Patient with Role-Based Permissions

```javascript
// Example: Nurse updating patient care type
const response = await fetch('http://localhost:3000/api/patients/patient-uuid/update', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    careType: 'Chemotherapy',
    metadata: {
      notes: 'Updated care instructions'
    }
  })
});

const result = await response.json();
```

**Role-Based Update Restrictions:**

| Role | Allowed Fields | Restrictions |
|------|----------------|--------------|
| Doctor | `metadata` | Can only update own patients |
| Nurse | `careType`, `metadata` | Limited to assigned care type |
| Admin | All fields | No restrictions |

### Handling RLS (Row Level Security) Errors

```javascript
try {
  const response = await fetch('http://localhost:3000/api/patients/patient-uuid/update', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  const result = await response.json();

  if (result.error === 'PERMISSION_DENIED') {
    // Handle RLS violation
    console.log('Cannot update this patient');
    // Show user-friendly error message
  }
} catch (error) {
  // Network or server errors
}
```

### Other Common Use Cases

[Previous quick start guide use cases remain the same]

## 🧪 RLS Error Handling Strategy

### Common RLS Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `42501` | Row Level Security Violation | Check user permissions |
| `ROLE_RESTRICTED` | Role-based Update Constraint | Limit update fields |

### Fallback Mechanism

1. Attempt direct Supabase update
2. If RLS blocks, use service-layer validation
3. Provide clear, actionable error messages

## 🛠️ Development Tools

[Previous development tools section remains the same]

## 🐛 Debugging RLS and Role-Based Issues

### Troubleshooting Steps

1. **401 Unauthorized**
   - Verify authentication token
   - Check token expiration

2. **403 Forbidden (RLS Violation)**
   - Confirm user role
   - Check patient assignment
   - Verify update field permissions

3. **Debugging RLS**
   ```bash
   # Enable detailed logging
   DEBUG=supabase:rls npm run dev
   ```

## 📚 Additional Resources

- [Full API Reference](./API-REFERENCE.md)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

## 💡 Best Practices

1. Always validate user role before updates
2. Use service-layer validation as a fallback
3. Provide clear error messages
4. Implement client-side permission checks
5. Log RLS violations for audit purposes