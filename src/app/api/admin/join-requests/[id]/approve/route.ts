import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

/**
 * POST /api/admin/join-requests/[id]/approve
 *
 * Approve a join request
 * Requires: Admin role, same organization as request
 *
 * Body (optional):
 * - assigned_role?: 'admin' | 'doctor' | 'nurse' (override requested role)
 *
 * Updates:
 * - User profile: organization_id, role
 * - Join request: status='approved', reviewer_id, reviewed_at
 */

const approveSchema = z.object({
  assigned_role: z.enum(["admin", "doctor", "nurse"]).optional(),
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
    const { data: adminProfile, error: profileError } = await (supabase as any)
          .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

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

    // 3. Parse optional body
    let assignedRole: string | undefined;
    try {
      const body = await request.json();
      const parsed = approveSchema.parse(body);
      assignedRole = parsed.assigned_role;
    } catch {
      // Body is optional, ignore parse errors
      assignedRole = undefined;
    }

    // 4. Fetch join request
    const { data: joinRequest, error: fetchError } = await (supabase as any)
          .from("join_requests")
      .select("*")
      .eq("id", requestId)
      .single();

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
          message: "Cannot approve requests from other organizations",
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

    // 7. Use RPC function to approve (handles transaction)
    const serviceSupabase = await createServiceClient();

    const finalRole = assignedRole || joinRequest.role;

    const rpcArgs = {
      p_join_request_id: requestId,
      p_admin_id: user.id,
      p_assigned_role: finalRole,
    };

    const { error: rpcError } = await (serviceSupabase as any).rpc(
      "approve_join_request",
      rpcArgs
    );

    if (rpcError) {
      console.error("Error approving join request:", rpcError);
      return NextResponse.json(
        { error: "Failed to approve join request", details: rpcError.message },
        { status: 500 }
      );
    }

    // 8. Fetch updated request
    const { data: updatedRequest, error: updateFetchError } = await (supabase as any)
          .from("join_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (updateFetchError) {
      console.error("Error fetching updated request:", updateFetchError);
    }

    return NextResponse.json({
      data: updatedRequest,
      message: "Join request approved successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Approve join request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
