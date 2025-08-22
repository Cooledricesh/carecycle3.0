# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


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
│   ├── api/               # API routes (auth endpoints)
│   ├── admin/             # Admin-specific pages
│   ├── dashboard/         # Main dashboard interface
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── admin/            # Admin-specific components
│   └── dashboard/        # Dashboard-specific components
├── features/             # Feature-based modules (when needed)
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── api.ts
├── hooks/                # Global React hooks
├── lib/                  # Utilities and configurations
│   └── supabase/        # Supabase client configurations
└── providers/           # React context providers
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
- Client-side auth: Use `@/lib/supabase/client.ts`
- Server-side auth: Use `@/lib/supabase/server.ts`
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
- Never expose service role keys in client code
- Always validate user input with Zod schemas
- Use HTTPS for all communications
- Implement proper error boundaries
- Sanitize data before database operations

## Environment Configuration

Required environment variables (see `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Testing & Quality Assurance

Currently no test framework is configured. When implementing tests:
- Consider Jest + React Testing Library for unit tests
- Use Playwright for E2E testing
- Test critical user flows and data validation
- Unit tests for core functionality
- Consider integration and end-to-end tests

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

## Internationalization

- Check for UTF-8 encoding issues with Korean text
- Ensure Korean characters display correctly (깨지는 한글 확인)
- Test with various character encodings