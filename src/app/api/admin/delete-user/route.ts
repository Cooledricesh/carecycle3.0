import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DeleteUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
});

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Protection: Verify same-origin request
    const origin = request.headers.get("origin") ||
                   request.headers.get("referer") ||
                   request.headers.get("host");

    const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL ||
                          `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`;

    if (origin && !origin.startsWith(expectedOrigin)) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    // 2. Verify admin permission
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Fetch current user profile with proper error handling
    const { data: currentProfile, error: profileError } = await userClient
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
    const { data: targetProfile, error: targetError } = await serviceClient
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
    if (targetProfile.role === "admin") {
      const { count: adminCount, error: countError } = await serviceClient
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

      if (adminCount && adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last remaining admin" },
          { status: 400 }
        );
      }
    }

    // 7. Delete auth user FIRST (triggers CASCADE to profiles)
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

    // 8. Clean up related data AFTER user deletion (non-critical operation)
    const { data: cleanupResult, error: cleanupError } = await serviceClient
      .rpc("admin_delete_user", { p_user_id: userId });

    if (cleanupError) {
      console.error("User data cleanup error:", cleanupError);
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