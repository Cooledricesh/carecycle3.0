import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "../database.types";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Service role client for admin operations
export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

// Auth helper functions
export async function getCurrentUser() {
  const supabase = await createClient();
  // CRITICAL: Use getSession() not getUser() - see AUTH_FAILURE_ANALYSIS.md
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  
  if (error || !session?.user) {
    return null;
  }
  
  return session.user;
}

export async function getCurrentUserProfile(): Promise<any> {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }
  
  // Simplified: Return user data as profile without fetching from profiles table
  // The profiles table query was causing hangs - see AUTH_FAILURE_ANALYSIS.md
  return {
    id: user.id,
    email: user.email,
    name: user.email?.split('@')[0] || 'User',
    role: 'user' // Default role
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function requireAdmin() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Admin access required");
  }
  return profile;
}
