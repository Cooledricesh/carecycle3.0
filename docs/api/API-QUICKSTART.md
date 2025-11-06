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


## 🔑 Quick Authentication

For detailed authentication flow and API key system documentation, see [API Reference - Authentication](./API-REFERENCE.md#authentication).

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPassword123!"}'

# Use the returned token
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
    careType: '입원',
    metadata: {
      notes: 'Updated care instructions'
    }
  })
});

const result = await response.json();
```

For role-based update restrictions, see [API Reference - Update Patient](./API-REFERENCE.md#update-patient-enhanced).

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


## 🧪 Error Handling

For comprehensive error codes and RLS handling strategies, see [API Reference - Error Handling](./API-REFERENCE.md#error-handling).

## 🛠️ Development Tools

### Testing API Endpoints
- Use `curl` for command-line testing
- Postman or Insomnia for GUI-based testing
- VS Code REST Client extension for in-editor testing

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