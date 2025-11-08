import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/join-requests
 *
 * List pending join requests for the admin's organization
 * Requires: Admin role
 *
 * Returns:
 * - Array of pending join requests with user details
 */

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await (supabase as any).auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Get user profile and verify admin role
    const { data: profile, error: profileError } = await (supabase as any)
          .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin role required" },
        { status: 403 }
      );
    }

    if (!profile.organization_id) {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin must belong to an organization" },
        { status: 403 }
      );
    }

    // 3. Fetch pending join requests for admin's organization
    const { data: joinRequests, error: fetchError } = await (supabase as any)
          .from("join_requests")
      .select(`
        id,
        email,
        name,
        organization_id,
        role,
        status,
        created_at,
        reviewed_at,
        reviewed_by,
        organizations (
          id,
          name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching join requests:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch join requests" },
        { status: 500 }
      );
    }

    // 4. Transform data to include organization_name
    const transformedRequests = joinRequests?.map((request: any) => {
      const org = Array.isArray(request.organizations) ? request.organizations[0] : request.organizations;
      return {
        ...request,
        organization_name: org?.name || null,
        organizations: undefined, // Remove nested object
      };
    });

    return NextResponse.json({
      data: transformedRequests || [],
      message: `Found ${transformedRequests?.length || 0} pending request(s)`,
    });
  } catch (error) {
    console.error("Join requests list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
