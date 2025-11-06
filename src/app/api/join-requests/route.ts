import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/join-requests
 *
 * Create a new join request for an existing organization
 * Requires: Authentication (user without organization_id)
 *
 * Body:
 * - organization_id: UUID (required) - Organization to join
 * - requested_role: 'admin' | 'doctor' | 'nurse' (required) - Desired role
 *
 * Returns:
 * - Created join request
 */

const createJoinRequestSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID"),
  requested_role: z.enum(["admin", "doctor", "nurse"], {
    errorMap: () => ({ message: "Role must be one of: admin, doctor, nurse" }),
  }),
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
    const { organization_id, requested_role } =
      createJoinRequestSchema.parse(body);

    // 3. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // 4. Check user doesn't already have an organization
    if (profile.organization_id) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "User already belongs to an organization",
        },
        { status: 400 }
      );
    }

    // 5. Verify email exists
    if (!profile.email) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "User email is required to create join request",
        },
        { status: 400 }
      );
    }

    // 6. Verify organization exists
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: "Not Found", message: "Organization not found" },
        { status: 404 }
      );
    }

    // 7. Check for existing pending request
    const { data: existingRequest, error: existingError } = await supabase
      .from("join_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .eq("status", "pending")
      .single();

    // If no error or error is not "no rows", it means there's an existing request
    if (existingRequest && existingError?.code !== "PGRST116") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "You already have a pending request for this organization",
        },
        { status: 400 }
      );
    }

    // 8. Create join request
    const { data: newRequest, error: createError } = await supabase
      .from("join_requests")
      .insert({
        user_id: user.id,
        email: profile.email,
        name: profile.name,
        organization_id,
        requested_role,
        status: "pending",
      })
      .select(
        `
        *,
        organizations (
          id,
          name
        )
      `
      )
      .single();

    if (createError) {
      console.error("Error creating join request:", createError);

      // Handle unique constraint violation
      if (createError.code === "23505") {
        return NextResponse.json(
          {
            error: "Bad Request",
            message: "You already have a pending request for this organization",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create join request", details: createError.message },
        { status: 500 }
      );
    }

    // 9. Transform response
    const response = {
      ...newRequest,
      organization_name: newRequest.organizations?.name || null,
      organizations: undefined,
    };

    return NextResponse.json(
      {
        data: response,
        message: "Join request created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.error("Join request creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
