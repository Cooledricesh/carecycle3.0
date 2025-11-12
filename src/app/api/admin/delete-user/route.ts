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

    // 7.5. Pre-delete auth.identities records (BUG-2025-11-12-USER-DELETE-AUTH-500)
    // Supabase Auth API cannot delete users with identity records.
    // This is an internal Auth API policy, unrelated to FK CASCADE settings.
    // We must delete identities first to unblock user deletion.
    // Note: Cannot use .from("auth.identities") because PostgREST cannot access auth schema.
    // Must use RPC function instead.
    const { data: identityResult, error: identityError } = await (serviceClient as any)
      .rpc("delete_user_identities", {
        p_user_id: userId
      });

    if (identityError) {
      // Non-critical: User might not have identity records
      // Log warning but continue to user deletion
      console.warn(
        `Identity deletion warning for user ${userId} (non-critical):`,
        identityError
      );
    } else if (identityResult) {
      console.log(
        `Deleted ${identityResult.deleted_count} identity record(s) for user ${userId}`
      );
    }

    // 8. Delete auth user FIRST (triggers CASCADE to profiles)
    const { error: authError } = await serviceClient.auth.admin.deleteUser(
      userId
    );

    if (authError) {
      console.error("Error deleting auth user:", authError);
      return NextResponse.json(
        { error: "Failed to delete user authentication" },
        { status: 500 }
      );
    }

    // 9. Clean up related data AFTER user deletion with pre-calculated params
    const { error: cleanupError } = await (serviceClient as any)
          .rpc("admin_delete_user", {
        p_user_id: userId,
        p_target_role: targetProfile.role,
        p_remaining_admins: remainingAdmins,
      });

    if (cleanupError) {
      console.error("CRITICAL: User data cleanup failed for user", userId, "Error:", cleanupError);
      return NextResponse.json(
        { error: "Failed to clean up user data. Manual recovery required." },
        { status: 500 }
      );
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