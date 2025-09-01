# Authentication Reference - Next.js + Supabase

This is a clean authentication reference implementation using Next.js and Supabase.

## Features

- **Cookie-based authentication** using supabase-ssr
- **Complete auth flow**:
  - Login with email/password
  - Sign up with email/password
  - Password reset flow
  - Email confirmation
  - Update password
- **Protected routes** with middleware
- **Server and client-side auth** patterns
- **Tailwind CSS** styling
- **shadcn/ui** components

## Authentication Files Structure

```
app/
├── auth/                   # Authentication routes
│   ├── login/             # Login page
│   ├── sign-up/           # Sign up page
│   ├── forgot-password/   # Password reset request
│   ├── update-password/   # Password update page
│   ├── sign-up-success/   # Post-signup success page
│   ├── confirm/           # Email confirmation route
│   └── error/            # Auth error page
├── protected/            # Protected route example
│   ├── layout.tsx       # Protected layout with auth check
│   └── page.tsx         # Protected page example
└── page.tsx             # Home page with auth button

components/
├── auth-button.tsx          # Auth status button
├── login-form.tsx           # Login form component
├── sign-up-form.tsx         # Sign up form component
├── forgot-password-form.tsx # Password reset form
├── update-password-form.tsx # Password update form
├── logout-button.tsx        # Logout button component
└── ui/                      # Basic UI components
    ├── button.tsx
    ├── input.tsx
    ├── label.tsx
    └── checkbox.tsx

lib/
└── supabase/
    ├── client.ts         # Client-side Supabase client
    ├── server.ts         # Server-side Supabase client
    └── middleware.ts     # Middleware auth helper

middleware.ts             # Next.js middleware for auth
```

## Key Authentication Patterns

### 1. Client-Side Auth
```typescript
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

### 2. Server-Side Auth (Server Components)
```typescript
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```

### 3. Middleware Protection
```typescript
import { updateSession } from "@/lib/supabase/middleware";
// Automatically handles session refresh
```

### 4. Protected Routes
- Use layout.tsx to check authentication
- Redirect to login if not authenticated
- Example in `/app/protected/layout.tsx`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

1. Copy authentication files to your project
2. Set up environment variables
3. Configure Supabase project with email auth
4. Customize forms and styling as needed

## Important Notes

- Uses cookies for auth (more secure than localStorage)
- Session automatically refreshes via middleware
- Forms include proper error handling
- Supports both server and client components