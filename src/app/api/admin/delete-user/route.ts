import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DeleteUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
});

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Protection: Verify same-origin request
    let actualOrigin: string | null = request.headers.get("origin");

    // If Origin header is missing, try to parse origin from Referer
    if (!actualOrigin) {
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          actualOrigin = refererUrl.origin;
        } catch {
          // Failed to parse referer, treat as no origin present
          actualOrigin = null;
        }
      }
    }

    // Build expected origin for comparison and normalize with URL API
    const expectedOriginString = process.env.NEXT_PUBLIC_APP_URL ||
                                 `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`;

    // Only compare if we have an actual origin
    if (actualOrigin) {
      try {
        // Normalize both origins using URL API for strict comparison
        const actualOriginNormalized = new URL(actualOrigin).origin;
        const expectedOriginNormalized = new URL(expectedOriginString).origin;

        // Strict equality check prevents prefix-based bypasses
        if (actualOriginNormalized !== expectedOriginNormalized) {
          return NextResponse.json(
            { error: "Invalid origin" },
            { status: 403 }
          );
        }
      } catch (urlError) {
        // Failed to parse origins, treat as invalid
        console.error("Origin parsing error:", urlError);
        return NextResponse.json(
          { error: "Invalid origin format" },
          { status: 403 }
        );
      }
    }

    // 2. Verify admin permission
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Fetch current user profile with proper error handling
    const { data: currentProfile, error: profileError } = await (userClient as any)
          .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Handle RLS/permission errors explicitly
    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json(
        { error: "Permission denied: unable to verify role" },
        { status: 403 }
      );
    }

    if (!currentProfile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 403 }
      );
    }

    if (currentProfile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validationResult = DeleteUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { userId } = validationResult.data;

    // 4. Prevent deleting own account
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // 5. Verify target user exists and check last admin protection
    const { data: targetProfile, error: targetError } = await (serviceClient as any)
          .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // 6. Prevent deleting the last admin
    let adminCount: number | null = null;

    if (targetProfile.role === "admin") {
      const { count, error: countError } = await (serviceClient as any)
          .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error("Admin count check error:", countError);
        return NextResponse.json(
          { error: "Failed to verify admin count" },
          { status: 500 }
        );
      }

      adminCount = count;

      if (adminCount && adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last remaining admin" },
          { status: 400 }
        );
      }
    }

    // 7. Calculate remaining admin count (for deletion guard in RPC)
    const remainingAdmins = targetProfile.role === "admin"
      ? ((adminCount ?? 0) - 1)
      : 0;

    // 7.5. Delete user directly via SQL (BUG-2025-11-12-USER-DELETE-TRIGGER-FIX)
    // Bypass Supabase Auth API and disable triggers to prevent notification INSERT errors
    // This RPC function deletes from auth schema tables and then profiles (CASCADE)
    const { data: deleteResult, error: deleteError } = await (serviceClient as any)
      .rpc("direct_delete_user_no_triggers", {
        p_user_id: userId
      });

    if (deleteError || (deleteResult && !deleteResult.success)) {
      console.error("Error deleting user:", deleteError || deleteResult);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    console.log(`User ${userId} deleted successfully via direct SQL`);

    // 8. Clean up related data AFTER user deletion with pre-calculated params
    const { error: cleanupError } = await (serviceClient as any)
          .rpc("admin_delete_user", {
        p_user_id: userId,
        p_target_role: targetProfile.role,
        p_remaining_admins: remainingAdmins,
      });

    if (cleanupError) {
      console.warn("Warning: User data cleanup failed for user", userId, "Error:", cleanupError);
      // Don't return error since user is already deleted
    }

    return NextResponse.json({
      message: "User deleted successfully",
      userId: userId,
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}