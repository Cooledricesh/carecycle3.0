# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: PLAYWRIGHT MCP 올바른 사용법 ⚠️

### 🚨 경고: 잘못 사용하면 브라우저 창 100개가 생성됩니다 🚨

**Playwright MCP 사용 시 반드시 따라야 할 규칙:**

1. **항상 이 패턴을 엄격히 따르세요:**
   ```javascript
   // 1. 먼저 기존 브라우저 종료
   mcp__playwright__browser_close()
   
   // 2. 테스트 수행
   mcp__playwright__browser_navigate({ url: "..." })
   mcp__playwright__browser_snapshot()
   // ... 필요한 작업
   
   // 3. 반드시 종료 (에러가 나도 실행되도록)
   try {
     // 테스트 코드
   } finally {
     mcp__playwright__browser_close()
   }
   ```

2. **절대 하지 말아야 할 것:**
   - ❌ browser_close 없이 navigate 연속 호출
   - ❌ 에러 발생 시 cleanup 생략
   - ❌ 여러 브라우저 인스턴스 동시 실행

3. **좀비 프로세스 발견 시:**
   ```bash
   ./kill-playwright.sh  # 즉시 실행
   ```

4. **대체 방법 (간단한 테스트):**
   - API 테스트: `curl` 사용
   - 상태 확인: 로그 분석


## Project Overview

Medical scheduling system for hospital nurses to automate recurring test and injection schedules. Built with Next.js 15, TypeScript, and Supabase.

## Common Development Commands

```bash
# Development
npm run dev          # Start development server with Turbopack

# Building
npm run build        # Build production application
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint for code quality checks

# Database Migrations
# Store new migrations in /supabase/migrations/ with format: YYYYMMDD######_description.sql
# Apply migrations through Supabase dashboard (do not run locally)

# Component Installation (shadcn/ui)
npx shadcn@latest add [component-name]  # Add new UI components
```

## Architecture & Project Structure

### Directory Organization
```
src/
├── app/                    # Next.js 15 App Router pages
│   ├── (app)/             # Protected app routes with layout
│   │   ├── dashboard/     # Main dashboard interface
│   │   ├── admin/         # Admin-specific pages
│   │   └── debug/         # Performance monitoring dashboard
│   ├── api/               # API routes (auth endpoints)
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── admin/            # Admin-specific components
│   ├── dashboard/        # Dashboard-specific components
│   ├── patients/         # Patient management components
│   └── schedules/        # Schedule management components
├── features/             # Feature-based modules (when needed)
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── api.ts
├── hooks/                # Global React hooks
│   ├── useRealtimeEvents.ts     # Real-time event subscriptions
│   ├── useOptimisticMutation.ts # Optimistic update utilities
│   └── useFallbackPolling.ts    # Polling fallback strategy
├── lib/                  # Utilities and configurations
│   ├── supabase/        # Supabase client configurations
│   ├── realtime/        # Real-time architecture
│   │   ├── event-manager.ts      # Event bus system
│   │   └── connection-manager.ts # WebSocket management
│   └── monitoring/      # Performance monitoring
│       └── performance-monitor.ts # Metrics collection
├── providers/           # React context providers
├── services/           # API service layers
└── types/             # TypeScript type definitions
```

### Key Technical Decisions

1. **Always use client components** - All components must include `'use client'` directive
2. **Promise-based page params** - Page components must use Promise for params props
3. **Supabase for backend** - Database, authentication, and API through Supabase
4. **No local Supabase** - Always use cloud Supabase instance, never run locally

## Essential Libraries & Their Usage

- **@tanstack/react-query**: Server state management and API caching
- **zustand**: Lightweight client-side global state (if needed)
- **date-fns**: Date manipulation and formatting
- **ts-pattern**: Type-safe pattern matching for complex branching
- **es-toolkit**: Utility functions (prefer over lodash)
- **react-use**: Common React hooks collection
- **zod**: Schema validation for forms and API data
- **react-hook-form**: Form state management with Zod validation
- **lucide-react**: Icon library
- **shadcn/ui**: Pre-built accessible UI components

## Critical Development Guidelines

### Code Style Principles
- **Functional programming**: Prefer pure functions, immutability, avoid mutations
- **Early returns**: Use guard clauses to reduce nesting
- **Descriptive naming**: Clear variable and function names over comments
- **Composition over inheritance**: Use function composition and hooks
- **DRY principle**: Extract reusable logic into utilities or hooks
- **Simplicity over complexity**: Write clear, maintainable code
- **Readability first**: Code should be self-documenting
- **Conditional classes over ternary**: More readable for styling logic
- **Constants > Functions**: Define constants when possible
- **Pure functions**: Minimize side effects
- **Minimal changes**: Make focused, targeted updates

### Functional Programming Patterns
- Avoid mutation - use immutable data structures
- Use Map, Filter, Reduce over imperative loops
- Apply currying and partial application when beneficial
- Maintain immutability throughout data transformations

### Next.js Specific
- **Always use client components** - Include `'use client'` directive in all components
- **Promise-based params** - Page components must use Promise for params props
- Use server components only when explicitly needed (default to client components)
- Implement proper loading and error boundaries
- Utilize Next.js Image component for optimized images
- Use dynamic imports for code splitting when appropriate
- Use valid picsum.photos stock images for placeholders

### Supabase Integration

**⚠️ IMPORTANT: New API Key System (2025)**
This project uses Supabase's **new API key system** (publishable/secret keys), **NOT** the legacy JWT token system (anon/service_role). Always use the helper functions below.

#### Required Patterns
- **Client-side operations**: Use `createClient()` from `@/lib/supabase/client.ts`
  - Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (safe for browser)
  - For authentication, user data fetching, real-time subscriptions
- **Server-side admin operations**: Use `createServiceClient()` from `@/lib/supabase/server.ts`
  - Uses `SUPABASE_SECRET_KEY` (server-only, bypasses RLS)
  - For admin operations, system tasks, service role actions
- **Server-side user operations**: Use `createClient()` from `@/lib/supabase/server.ts`
  - Uses publishable key with user session context
  - For user-scoped database operations with RLS

#### Key Implementation Rules
- **Never import `@supabase/supabase-js` directly** in application code
- **Always use helper functions** from `/lib/supabase/` directory
- **Never mix key systems** - this project is 100% new API key system
- **Environment validation**: All clients validate required environment variables

#### Database & Migration Guidelines
- Database types: Generated in `@/lib/database.types.ts`
- RLS policies: Always enabled, defined in migration files
- Migrations: Store in `/supabase/migrations/` with proper numbering
- **Never run Supabase locally** - Always use cloud instance
- Create migration files in `.sql` format with YYYYMMDD######_description.sql naming

### Supabase Migration Best Practices
- **Unique naming**: Each migration file must have unique number prefix
- **Idempotency**: Migrations must be runnable multiple times without error
- **Safe creation**: Use `CREATE TABLE IF NOT EXISTS`
- **Error handling**: Include `BEGIN` and `EXCEPTION` blocks
- **Documentation**: Add comments for complex operations
- **Explicit types**: Always specify column types
- **Constraints**: Include NOT NULL, UNIQUE where appropriate
- **Timestamps**: Add updated_at column with trigger to all tables
- **Conflict check**: Review existing migrations to avoid conflicts
- **Small scope**: Keep migrations focused and minimal
- **Naming convention**: Use snake_case for all identifiers
- **RLS**: Implement Row Level Security for access control
- **Indexes**: Add strategically for frequently queried columns
- **Foreign keys**: Use constraints for referential integrity
- **Enums**: Use for fields with fixed value sets
- **Performance**: Avoid altering large production tables directly

### Security & Data Handling
- **Never expose secret keys in client code** - Only publishable keys are browser-safe
- **Use proper client separation**: `createClient()` for users, `createServiceClient()` for admin operations
- Always validate user input with Zod schemas
- Use HTTPS for all communications
- Implement proper error boundaries
- Sanitize data before database operations
- **Environment validation**: All Supabase clients validate required environment variables before creation

## Environment Configuration

**⚠️ UPDATED: New API Key System Variables**

Required environment variables (see `.env.example`):
```env
# ✅ NEW SYSTEM: Required for all environments
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Key Differences from Legacy System:**
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` replaces `SUPABASE_SERVICE_ROLE_KEY`
- New keys are string-based, not JWT tokens
- Publishable key is safe for browser exposure, secret key is server-only

**Migration Notes:**
- All legacy environment variables have been removed
- Helper functions automatically validate these variables
- See `/SUPABASE_NEW_API_KEYS_REFERENCE.md` for detailed migration guide

## Testing & Quality Assurance

Currently no test framework is configured. When implementing tests:
- Consider Jest + React Testing Library for unit tests
- Use Playwright for E2E testing
- Test critical user flows and data validation
- Unit tests for core functionality
- Consider integration and end-to-end tests

## Playwright MCP Usage Guide

### Overview
Playwright MCP is used for browser automation and E2E testing. Configuration files in `.playwright-mcp/` prevent multiple browser tabs issue.

### Best Practices for Playwright MCP

1. **Browser Management**
   - Always close browser after test sequences: `mcp__playwright__browser_close`
   - Check for existing browser before starting new tests
   - Use single browser context for related operations

2. **Common Commands**
   ```bash
   # Close all Playwright browsers
   mcp__playwright__browser_close
   
   # Kill zombie Playwright processes
   pkill -f "chrome.*playwright"
   
   # Clear Playwright cache (if issues persist)
   rm -rf ~/Library/Caches/ms-playwright/
   ```

3. **Test Structure Pattern**
   ```javascript
   // 1. Navigate to page
   mcp__playwright__browser_navigate({ url: "http://localhost:3000" })
   
   // 2. Take snapshot for visual reference
   mcp__playwright__browser_snapshot()
   
   // 3. Interact with elements
   mcp__playwright__browser_click({ element: "button", ref: "button-ref" })
   
   // 4. Wait for results
   mcp__playwright__browser_wait_for({ text: "Success" })
   
   // 5. Clean up
   mcp__playwright__browser_close()
   ```

4. **Troubleshooting Multiple Tabs Issue**
   - Configuration in `.playwright-mcp/config.js` controls browser behavior
   - Set `autoClose: true` for automatic tab cleanup
   - Use `maxTabs: 1` to limit open tabs
   - Helper functions in `.playwright-mcp/browser-helper.js` manage lifecycle

5. **Important Notes**
   - Do NOT run multiple browser instances simultaneously
   - Always handle errors to ensure cleanup runs
   - Monitor browser process count during tests
   - Restart Claude Desktop if MCP connection issues persist

### Testing Workflow with Playwright MCP

1. **Pre-test Cleanup**
   ```bash
   # Ensure no browsers are running
   mcp__playwright__browser_close
   ```

2. **Run Tests**
   - Use browser_snapshot for debugging visual issues
   - Implement proper waits between actions
   - Verify elements exist before interacting

3. **Post-test Cleanup**
   - Always close browser after test completion
   - Check for zombie processes if tabs persist
   - Clear cache if performance degrades

## Development Workflow

### Solution Process
1. **Rephrase Input**: Transform to clear, professional prompt
2. **Analyze & Strategize**: Identify issues, outline solutions, define output format
3. **Develop Solution**: List steps numerically, enumerate solutions with bullet points
4. **Validate Solution**: Review, refine, test against edge cases
5. **Evaluate Progress**: Pause if incomplete, proceed if satisfactory
6. **Prepare Final Output**: Include problem summary, step-by-step solution with code snippets

### Component Development
- When adding new shadcn/ui components, provide installation command:
  ```bash
  npx shadcn@latest add [component-name]
  ```
- Follow existing component patterns and conventions
- Ensure components are reusable and accessible

### Error Handling
- Use appropriate error handling techniques
- Prefer returning errors over throwing exceptions
- Use TODO: and FIXME: comments for tracking issues
- Handle errors gracefully with user-friendly messages

### Comments & Documentation
- Comment function purpose, not implementation details
- Use JSDoc for JavaScript/TypeScript functions
- Document "why" not "what"
- Minimize AI-generated comments, prefer self-documenting code

### Function Organization
- Place higher-order functionality first
- Group related functions together
- Maintain consistent file structure

## Vooster Documentation References

<vooster-docs>
- @vooster-docs/prd.md
- @vooster-docs/architecture.md
- @vooster-docs/guideline.md
- @vooster-docs/step-by-step.md
- @vooster-docs/clean-code.md
</vooster-docs>

The project includes detailed documentation in `/vooster-docs/`:
- `prd.md`: Product requirements and features
- `architecture.md`: Technical architecture details
- `guideline.md`: Development guidelines
- `step-by-step.md`: Implementation steps
- `clean-code.md`: Code quality standards

## Performance Considerations

- Implement code splitting with dynamic imports
- Use React Query for efficient data caching
- Optimize images with Next.js Image component
- Implement proper loading states with Suspense
- Use memo and useMemo for expensive computations
- Avoid premature optimization
- Profile before optimizing
- Optimize judiciously with documentation
- Document all optimization decisions

## Key Development Mindsets

1. **Simplicity** - Choose simple solutions over complex ones
2. **Readability** - Code should be easily understood
3. **Maintainability** - Consider long-term maintenance
4. **Testability** - Write testable code
5. **Reusability** - Extract common patterns
6. **Functional Paradigm** - Prefer functional approaches
7. **Pragmatism** - Balance ideals with practical needs

## Deployment Notes

- ESLint errors are ignored during build (`ignoreDuringBuilds: true`)
- Ensure all environment variables are set in production
- Database migrations must be applied before deployment
- Monitor Supabase usage limits and quotas

## Package Management

- Use **npm** as the package manager (not yarn or pnpm)
- Keep dependencies up to date but test thoroughly
- Document any version-specific requirements

## Real-time Architecture Guidelines

### Event-Driven System
- **Event Manager**: Central event bus for all real-time updates
  - Use `eventManager.subscribeToTable()` for table-specific events
  - Use `eventManager.subscribeToConnection()` for connection state
  - Always clean up subscriptions in useEffect cleanup
- **Connection Manager**: Single WebSocket connection point
  - Automatically handles reconnection with exponential backoff
  - Monitors connection health and emits status events
  - Single channel for all database changes

### Optimistic Updates Pattern
```typescript
// Example: Optimistic delete with rollback
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey })
  const previousData = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, optimisticUpdate)
  return { previousData }
},
onError: (error, variables, context) => {
  if (context?.previousData) {
    queryClient.setQueryData(queryKey, context.previousData)
  }
}
```

### Fallback Polling Strategy
- Use `useFallbackPolling()` hook for critical data
- Polling intervals:
  - Connected: 30-60 seconds (backup polling)
  - Disconnected: 3-5 seconds (primary data sync)
- Pre-configured hooks: `useDashboardPolling()`, `usePatientsPolling()`

### Performance Monitoring
- Access debug dashboard at `/debug` for real-time metrics
- Key metrics to monitor:
  - Cache hit rate (target > 70%)
  - Average query time (target < 500ms)
  - Connection uptime (target > 90%)
  - Error rate (target < 5%)
- Use `performanceMonitor.recordMetric()` for custom metrics

### Best Practices
1. **Single Source of Truth**: Let React Query manage cache, don't duplicate in local state
2. **Event Isolation**: Each component subscribes only to relevant events
3. **Graceful Degradation**: Always implement fallback for real-time failures
4. **User Feedback**: Show connection status and sync indicators
5. **Cleanup**: Always unsubscribe from events in cleanup functions

## Troubleshooting Guide

### Common Issues & Solutions

#### Real-time Sync Not Working
1. Check `/debug` dashboard for connection status
2. Verify Supabase Realtime is enabled for tables
3. Check browser console for WebSocket errors
4. Ensure RLS policies allow SELECT on subscribed tables
5. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

#### Session Lost on Page Refresh
1. Check middleware.ts authentication paths match actual routes
2. Verify cookies are being set correctly
3. Check for auth state listener in auth-provider
4. Ensure proper cookie configuration in Supabase client

#### Optimistic Updates Not Rolling Back
1. Ensure `onMutate` returns context with previous data
2. Check `onError` handler restores previous data from context
3. Verify mutation key matches query key exactly

#### High Query Times (> 1000ms)
1. Check database indexes are properly created
2. Verify materialized views are refreshed
3. Review N+1 query patterns
4. Consider pagination for large datasets

#### Memory Leaks in Development
1. Check for missing cleanup in useEffect hooks
2. Ensure event subscriptions are unsubscribed
3. Clear intervals/timeouts properly
4. Check for circular references in state

## 🔄 Supabase API System Migration Guide

**📅 Migration Completed: January 2025**

This project has been **completely migrated** from Supabase's legacy JWT token system to the new API key system. All developers must follow these updated patterns.

### ⚠️ Critical Developer Guidelines

#### What Changed
- **Legacy System REMOVED**: No more `anon` or `service_role` JWT tokens
- **New System ONLY**: Uses `publishable` and `secret` string-based keys
- **Helper Functions Required**: Direct imports of `@supabase/supabase-js` are prohibited

#### For New Developers
```typescript
// ✅ CORRECT: Use helper functions
import { createClient } from '@/lib/supabase/client'
import { createServiceClient } from '@/lib/supabase/server'

// Client-side component
const supabase = createClient()
const { data } = await supabase.from('patients').select('*')

// Server-side API route (admin operations)
const supabase = await createServiceClient()
const { data } = await supabase.from('patients').insert(newPatient)
```

```typescript
// ❌ WRONG: Never do this
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey) // Legacy pattern - will break
```

#### Environment Setup for New Developers
1. Copy `.env.example` to `.env.local`
2. Get new API keys from team lead or Supabase dashboard
3. **Never use legacy JWT tokens** (the long `eyJ...` strings)

```env
# ✅ CORRECT: New API keys look like this
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_[project]_[string]
SUPABASE_SECRET_KEY=sb_secret_[project]_[string]

# ❌ WRONG: Legacy JWT tokens (DO NOT USE)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (removed)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (removed)
```

#### Common Development Patterns

**Authentication & User Operations:**
```typescript
// In components/pages (client-side)
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**Admin Operations in API Routes:**
```typescript
// In app/api/* (server-side)
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServiceClient()
  // This bypasses RLS for admin operations
  const { data } = await supabase.from('patients').insert(adminData)
}
```

**User-Scoped Operations in API Routes:**
```typescript
// In app/api/* (server-side with user context)
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient() // Respects RLS
  const { data } = await supabase.from('patients').select('*')
}
```

#### Migration Verification
Run this script to check for legacy patterns:
```bash
./scripts/check-legacy-keys.sh
```

#### Additional Resources
- **Full migration guide**: `/SUPABASE_NEW_API_KEYS_REFERENCE.md`
- **Emergency procedures**: `/emergency-security-measures.md`
- **Detection scripts**: `/scripts/check-legacy-keys.sh`

### 🚨 Troubleshooting

**"Invalid API key" Error:**
1. Check environment variables are set correctly
2. Ensure using new API keys, not legacy JWT tokens
3. Verify helper functions are being used, not direct imports

**"Environment variables missing" Error:**
1. Create `.env.local` file in project root
2. Add all required variables from `.env.example`
3. Restart development server

**Legacy Code Found:**
1. Run `./scripts/check-legacy-keys.sh` to identify issues
2. Replace direct imports with helper functions
3. Update environment variables to new system

## Internationalization

- Check for UTF-8 encoding issues with Korean text
- Ensure Korean characters display correctly (깨지는 한글 확인)
- Test with various character encodings
- 제발 포트 실행되어 있는지 아닌지 체크하고 개발 서버 열어. 이미 열려있는데 왜 자꾸 npm run dev 실행하냐?
- test@example.com / Test123!@# 테스트 계정으로 로그인할 때 사용하는 아이디/비밀번호야.