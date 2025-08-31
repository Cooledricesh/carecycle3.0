import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "./src/lib/database.types";

// Simple in-memory cache for session validation (prevents rate limits)
const sessionCache = new Map<string, { user: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get session ID for caching
  const sessionId = request.cookies.get('carecycle-auth')?.value || 
                   request.cookies.get('sb-rbtzwpfuhbjfmdkpigbt-auth-token')?.value;
  
  let user = null;
  
  // Check cache first to avoid hitting rate limits
  if (sessionId) {
    const cached = sessionCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      user = cached.user;
    }
  }
  
  // If not in cache, get from Supabase (use getSession, not getUser to reduce API calls)
  if (!user) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('[Middleware] Session error:', error.message);
        // Handle rate limit and token errors by clearing session
        if (error.message?.includes('refresh_token_not_found') || 
            error.message?.includes('over_request_rate_limit')) {
          // Clear cookies and redirect to signin
          const response = NextResponse.redirect(new URL('/auth/signin', request.url));
          response.cookies.delete('carecycle-auth');
          response.cookies.delete('sb-rbtzwpfuhbjfmdkpigbt-auth-token');
          return response;
        }
      }
      
      user = session?.user || null;
      
      // Cache the result
      if (sessionId && user) {
        sessionCache.set(sessionId, { user, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('[Middleware] Unexpected error:', err);
      user = null;
    }
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/callback"];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith("/auth/callback");

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/auth/signin", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated and trying to access auth pages (except callback)
  if (user && pathname.startsWith("/auth/") && pathname !== "/auth/callback") {
    // Get user profile to determine redirect destination
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // If profile fetch fails, still redirect to dashboard (don't block access)
    const redirectPath = profile?.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // Role-based route protection
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Admin route protection
    if (pathname.startsWith("/admin/") && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Nurse route protection (optional - nurses can access their dashboard)
    if ((pathname === "/dashboard" || pathname.startsWith("/dashboard/")) && !profile) {
      // If profile doesn't exist yet, create a default one instead of redirecting
      console.log('[Middleware] No profile found for user, allowing access');
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};