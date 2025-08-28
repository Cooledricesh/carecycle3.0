# 📚 Medical Scheduling System - API Documentation

A comprehensive REST API for managing patient medical schedules, automating recurring tests and injections for hospital nurses.

## 🎯 Quick Navigation

| Resource | Description |
|----------|-------------|
| **[API Quick Start](./API-QUICKSTART.md)** | Get started in 5 minutes |
| **[API Reference](./API-REFERENCE.md)** | Complete endpoint documentation |
| **[Interactive Docs](http://localhost:3000/api-docs)** | Swagger UI (requires dev server) |
| **[OpenAPI Spec](./openapi.yaml)** | OpenAPI 3.0 specification |
| **[Postman Collection](./medical-scheduler.postman_collection.json)** | Import to Postman |
| **[Postman Environment](./medical-scheduler.postman_environment.json)** | Environment variables |

## 🚀 Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Access Interactive Documentation

Open your browser and navigate to:
```
http://localhost:3000/api-docs
```

### 3. Import to Postman

```bash
# Generate/update Postman collection
npm run api:docs
```

Then import these files into Postman:
- `docs/medical-scheduler.postman_collection.json`
- `docs/medical-scheduler.postman_environment.json`

## 📋 API Overview

### Base URLs

- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.medical-scheduler.com`

### Authentication

All endpoints require JWT Bearer token authentication (except `/auth/login`).

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Main Resources

#### 🔐 Authentication
- `POST /auth/login` - User authentication
- `POST /auth/logout` - End session
- `POST /auth/refresh` - Refresh access token

#### 👥 Patients
- `GET /patients` - List all patients
- `POST /patients` - Create new patient
- `GET /patients/{id}` - Get patient details
- `PUT /patients/{id}` - Update patient
- `DELETE /patients/{id}` - Soft delete patient

#### 📅 Schedules
- `GET /schedules` - List schedules
- `POST /schedules` - Create schedule
- `GET /schedules/{id}` - Get schedule details
- `PUT /schedules/{id}` - Update schedule
- `POST /schedules/{id}/complete` - Mark as completed
- `DELETE /schedules/{id}` - Cancel schedule

#### 📊 Dashboard
- `GET /dashboard/stats` - Dashboard statistics

#### 💊 Medical Items
- `GET /items` - List medical items/procedures

## 🔄 Real-time Updates

The API supports WebSocket connections for real-time updates:

- Patient events (created, updated, deleted)
- Schedule events (created, completed, overdue)
- Dashboard updates

## 📦 Response Format

### Success Response

```json
{
  "data": { /* Resource data */ },
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* Additional context */ }
}
```

## 🛠️ Development Tools

### Generate API Documentation

```bash
# Update Postman collection from OpenAPI spec
npm run api:docs
```

### Test with cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Get patients (with token)
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test with HTTPie

```bash
# Login
http POST localhost:3000/api/auth/login \
  email=test@example.com \
  password=password

# Get patients
http GET localhost:3000/api/patients \
  "Authorization: Bearer YOUR_TOKEN"
```

## 📈 Performance Guidelines

1. **Pagination**: Use `limit` and `offset` for large datasets
2. **Caching**: Implement client-side caching with React Query
3. **Real-time**: Use WebSocket for live updates instead of polling
4. **Batch Operations**: Use batch endpoints when available

## 🔒 Security

- JWT-based authentication
- Row-Level Security (RLS) in Supabase
- Input validation with Zod schemas
- Rate limiting (100 req/min default)
- HTTPS only in production

## 📖 Documentation Files

```
docs/
├── README.md                                    # This file
├── API-QUICKSTART.md                           # Quick start guide
├── API-REFERENCE.md                            # Complete API reference
├── openapi.yaml                                # OpenAPI 3.0 specification
├── medical-scheduler.postman_collection.json   # Postman collection
└── medical-scheduler.postman_environment.json  # Postman environment
```

## 🤝 Support & Contributing

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: PRs welcome for documentation improvements
- **API Changes**: Follow OpenAPI spec for consistency

## 📝 License

MIT License - See LICENSE file for details

---

**Version**: 1.0.0 | **Last Updated**: January 2025