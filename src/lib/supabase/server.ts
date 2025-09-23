import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "../database.types";

/**
 * Creates a Supabase client for regular user operations using the publishable key
 * This client respects RLS policies and user sessions
 * 
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required');
  }

  return createServerClient<Database>(
    url,
    publishableKey,
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

/**
 * Creates a Supabase client for admin operations using the secret key
 * This client bypasses RLS policies and should ONLY be used on trusted servers
 * NEVER expose this client or its key to the browser
 */
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for admin operations');
  }

  return createServerClient<Database>(
    url,
    secretKey,
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

  // Fetch actual profile from database
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    // Fallback to default if profile not found
    return {
      id: user.id,
      email: user.email,
      name: user.email?.split('@')[0] || 'User',
      role: 'user'
    };
  }

  return profile;
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
