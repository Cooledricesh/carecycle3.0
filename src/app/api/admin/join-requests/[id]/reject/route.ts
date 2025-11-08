import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

/**
 * POST /api/admin/join-requests/[id]/reject
 *
 * Reject a join request
 * Requires: Admin role, same organization as request
 *
 * Body:
 * - reason?: string (optional) - Reason for rejection
 *
 * Updates:
 * - Join request: status='rejected', reviewer_id, reviewed_at, reason
 */

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

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

    // 2. Get admin profile
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single<{ id: string; role: string; organization_id: string | null }>();

    if (profileError || !adminProfile) {
      return NextResponse.json(
        { error: "Failed to fetch admin profile" },
        { status: 500 }
      );
    }

    if (adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin role required" },
        { status: 403 }
      );
    }

    // 3. Parse body
    let reason: string | undefined;
    try {
      const body = await request.json();
      const parsed = rejectSchema.parse(body);
      reason = parsed.reason;
    } catch {
      // Reason is optional, ignore parse errors
      reason = undefined;
    }

    // 4. Fetch join request
    const { data: joinRequest, error: fetchError } = await supabase
      .from("join_requests")
      .select("*")
      .eq("id", requestId)
      .single<Database['public']['Tables']['join_requests']['Row']>();

    if (fetchError || !joinRequest) {
      return NextResponse.json(
        { error: "Not Found", message: "Join request not found" },
        { status: 404 }
      );
    }

    // 5. Verify request is for admin's organization
    if (joinRequest.organization_id !== adminProfile.organization_id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Cannot reject requests from other organizations",
        },
        { status: 403 }
      );
    }

    // 6. Check request is pending
    if (joinRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Bad Request", message: "Request has already been processed" },
        { status: 400 }
      );
    }

    // 7. Use RPC function to reject
    const serviceSupabase = await createServiceClient();

    const rpcArgs = {
      p_join_request_id: requestId,
      p_admin_id: user.id,
      p_rejection_reason: reason || undefined,
    };

    const { error: rpcError } = await (serviceSupabase as any).rpc(
      "reject_join_request",
      rpcArgs
    );

    if (rpcError) {
      console.error("Error rejecting join request:", rpcError);
      return NextResponse.json(
        { error: "Failed to reject join request", details: rpcError.message },
        { status: 500 }
      );
    }

    // 8. Fetch updated request
    const { data: updatedRequest, error: updateFetchError } = await supabase
      .from("join_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (updateFetchError) {
      console.error("Error fetching updated request:", updateFetchError);
    }

    return NextResponse.json({
      data: updatedRequest,
      message: "Join request rejected successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Reject join request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
