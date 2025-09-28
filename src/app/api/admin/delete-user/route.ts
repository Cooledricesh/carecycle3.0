import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DeleteUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
});

export async function POST(request: NextRequest) {
  try {
    // Verify admin permission
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

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

    // Prevent deleting own account
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Delete/nullify ALL related data (12 foreign keys to profiles)
    await serviceClient.from("audit_logs").delete().eq("user_id", userId);
    await serviceClient.from("notifications").delete().eq("recipient_id", userId);
    await serviceClient.from("schedule_logs").delete().eq("changed_by", userId);
    await serviceClient.from("user_preferences").delete().eq("user_id", userId);
    await serviceClient.from("query_performance_log").delete().eq("user_id", userId);

    await serviceClient.from("schedule_executions").update({ executed_by: null }).eq("executed_by", userId);
    await serviceClient.from("schedule_executions").update({ doctor_id_at_completion: null }).eq("doctor_id_at_completion", userId);
    await serviceClient.from("schedules").update({ created_by: null }).eq("created_by", userId);
    await serviceClient.from("schedules").update({ assigned_nurse_id: null }).eq("assigned_nurse_id", userId);
    await serviceClient.from("patients").update({ created_by: null }).eq("created_by", userId);
    await serviceClient.from("patients").update({ doctor_id: null }).eq("doctor_id", userId);
    await serviceClient.from("patient_schedules").update({ nurse_id: null }).eq("nurse_id", userId);
    await serviceClient.from("patient_schedules").update({ created_by: null }).eq("created_by", userId);
    await serviceClient.from("profiles").update({ approved_by: null }).eq("approved_by", userId);

    // 5. Delete auth user (Supabase will automatically cascade to profiles)
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