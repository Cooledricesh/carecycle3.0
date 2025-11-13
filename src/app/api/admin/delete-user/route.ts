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

    // 7. Delete user via Supabase Auth API
    // This triggers the 2-layer architecture:
    //   Layer 1: Auth API deletes auth.users
    //   Layer 2: FK CASCADE deletes profiles, which triggers:
    //     - check_last_admin() BEFORE DELETE (protection)
    //     - anonymize_user_audit_logs() BEFORE DELETE (cleanup)
    //     - FK CASCADE on profiles deletion (notifications, SET NULL on schedules, etc.)
    //     - set_updated_at() AFTER UPDATE (timestamps)
    //     - All other triggers remain active
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      console.error("User deletion error:", deleteError);
      return NextResponse.json(
        {
          error: "사용자 삭제 중 오류가 발생했습니다",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    console.log(`User ${userId} deleted successfully via Auth API`);

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