import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "../database.types";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static assets and API health checks
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
          cookiesToSet.forEach(({ name, value }) =>
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

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const { data: { user } } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/callback", "/auth/update-password"];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith("/auth/callback");
  
  // Routes that should be accessible regardless of approval status
  const approvalExemptRoutes = ["/approval-pending", ...publicRoutes];
  const isApprovalExempt = approvalExemptRoutes.includes(pathname) || pathname.startsWith("/auth/callback");

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/auth/signin", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated, check their approval status
  if (user && !isApprovalExempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status, is_active")
      .eq("id", user.id)
      .single();

    // Redirect to approval pending if user is not approved or not active
    if (!profile || profile.approval_status !== 'approved' || !profile.is_active) {
      return NextResponse.redirect(new URL("/approval-pending", request.url));
    }
  }

  // If user is authenticated and trying to access auth pages (except callback and update-password)
  const authExceptions = ["/auth/callback", "/auth/update-password"];
  if (user && pathname.startsWith("/auth/") && !authExceptions.includes(pathname)) {
    // Get user profile to determine redirect destination
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status, is_active")
      .eq("id", user.id)
      .single();

    // If not approved/active, redirect to pending page
    if (!profile || profile.approval_status !== 'approved' || !profile.is_active) {
      return NextResponse.redirect(new URL("/approval-pending", request.url));
    }

    const redirectPath = profile?.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // Role-based route protection for approved users
  if (user && !isPublicRoute && !isApprovalExempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status, is_active")
      .eq("id", user.id)
      .single();

    // Double-check approval status for protected routes
    if (!profile || profile.approval_status !== 'approved' || !profile.is_active) {
      return NextResponse.redirect(new URL("/approval-pending", request.url));
    }

    // Admin route protection
    if (pathname.startsWith("/admin/") && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse;
}