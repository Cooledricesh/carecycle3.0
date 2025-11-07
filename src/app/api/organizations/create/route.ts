import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/organizations/create
 *
 * Create new organization during signup and assign user as first admin
 * Requires authentication (user must be signed up but not yet assigned to org)
 *
 * Body:
 * - organization_name: string (required) - Name of new organization
 * - user_role?: string (optional, default 'admin') - Role for the first user
 *
 * Returns:
 * - organization_id: UUID of created organization
 * - Updated user profile
 */

const createOrgSchema = z.object({
  organization_name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be less than 100 characters"),
  user_role: z.enum(["admin", "doctor", "nurse"]).default("admin"),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const { organization_name, user_role } = createOrgSchema.parse(body);

    // 3. Get user profile to check if already has organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (profile.organization_id) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "User already belongs to an organization",
        },
        { status: 400 }
      );
    }

    // 4. Create organization and register user using RPC function
    const serviceSupabase = await createServiceClient();

    const { data: organizationId, error: rpcError } =
      await serviceSupabase.rpc("create_organization_and_register_user", {
        p_organization_name: organization_name,
        p_user_id: user.id,
        p_user_name: profile.name,
        p_user_role: user_role,
      });

    if (rpcError) {
      console.error("Error creating organization:", rpcError);

      // Handle duplicate organization name
      if (rpcError.code === "23505" || rpcError.message?.includes("duplicate")) {
        return NextResponse.json(
          {
            error: "Conflict",
            message: "An organization with this name already exists",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create organization", details: rpcError.message },
        { status: 500 }
      );
    }

    // 5. Fetch updated profile
    const { data: updatedProfile, error: fetchError } = await serviceSupabase
      .from("profiles")
      .select("id, name, email, role, organization_id")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching updated profile:", fetchError);
    }

    return NextResponse.json({
      data: {
        organization_id: organizationId,
        profile: updatedProfile,
      },
      message: "Organization created successfully",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Organization creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
