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

### Create a Patient

```javascript
const response = await fetch('http://localhost:3000/api/patients', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'John Doe',
    patientNumber: 'P12345',
    department: 'Oncology'
  })
});

const patient = await response.json();
```

### Create a Recurring Schedule

```javascript
const response = await fetch('http://localhost:3000/api/schedules', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    patientId: patient.id,
    itemId: 'blood-test-item-id',
    intervalType: 'weekly',
    startDate: '2025-01-01'
  })
});

const schedule = await response.json();
```

### Get Today's Tasks

```javascript
const response = await fetch('http://localhost:3000/api/schedules?type=today', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const todaySchedules = await response.json();
```

### Mark Schedule as Completed

```javascript
const response = await fetch(`http://localhost:3000/api/schedules/${scheduleId}/complete`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    executedDate: new Date().toISOString(),
    executedBy: userId,
    notes: 'Completed successfully',
    createNext: true
  })
});
```

## 🧪 Using Postman

### Import Collection

1. Download the Postman collection from `/docs/medical-scheduler.postman_collection.json`
2. Download the environment from `/docs/medical-scheduler.postman_environment.json`
3. Import both files into Postman
4. Set your access token in the environment variables

### Testing Workflow

1. **Login** - Run the login request to get your token
2. **Set Token** - Copy the token to the environment variable
3. **Create Patient** - Test patient creation
4. **Create Schedule** - Set up a recurring schedule
5. **View Dashboard** - Check dashboard statistics

## 🔄 Real-time Updates

### WebSocket Connection

```javascript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Subscribe to patient changes
const subscription = supabase
  .channel('patients-channel')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'patients' },
    (payload) => {
      console.log('Patient change:', payload);
    }
  )
  .subscribe();
```

### Event Types

- `INSERT` - New record created
- `UPDATE` - Record modified
- `DELETE` - Record deleted

## 📊 Using with React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch patients
const { data: patients } = useQuery({
  queryKey: ['patients'],
  queryFn: async () => {
    const response = await fetch('/api/patients', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }
});

// Create patient
const createPatient = useMutation({
  mutationFn: async (newPatient) => {
    const response = await fetch('/api/patients', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newPatient)
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['patients']);
  }
});
```

## 🛠️ Development Tools

### API Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: `/docs/openapi.yaml`
- **Postman Collection**: `/docs/medical-scheduler.postman_collection.json`

### Database Migrations

Create new migrations in `/supabase/migrations/`:

```sql
-- YYYYMMDD######_description.sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```

### Testing API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# With authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/patients

# With query parameters
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/schedules?type=today&status=active"
```

## 🐛 Debugging

### Common Issues

1. **401 Unauthorized**
   - Check if token is valid and not expired
   - Verify token is included in Authorization header

2. **404 Not Found**
   - Verify the endpoint URL is correct
   - Check if the resource exists

3. **500 Internal Server Error**
   - Check server logs for details
   - Verify database connection
   - Check Supabase RLS policies

### Enable Debug Mode

Set environment variable:
```env
DEBUG=api:*
```

### Check Logs

```bash
# Development server logs
npm run dev

# Supabase logs (if using cloud)
# Access via Supabase dashboard
```

## 📚 Additional Resources

- [Full API Reference](./API-REFERENCE.md)
- [OpenAPI Specification](./openapi.yaml)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

## 💡 Tips

1. **Use Pagination**: Always paginate large datasets
2. **Cache Responses**: Implement caching for frequently accessed data
3. **Handle Errors**: Implement proper error handling and retries
4. **Rate Limiting**: Respect rate limits to avoid throttling
5. **Batch Operations**: Use batch endpoints for bulk operations when available

## 🤝 Need Help?

- Check the [API Reference](./API-REFERENCE.md)
- Visit http://localhost:3000/api-docs for interactive docs
- Report issues on GitHub
- Contact support@medical-scheduler.com