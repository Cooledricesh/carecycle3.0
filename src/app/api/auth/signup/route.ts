import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["nurse", "admin", "doctor"]).default("nurse"),
  care_type: z.string().optional(),
  phone: z.string().optional(),
  organization_id: z.string().min(1, "Organization ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, care_type, phone, organization_id } = signupSchema.parse(body);

    const supabase = await createClient();

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Signup failed" },
        { status: 400 }
      );
    }

    // Create profile using service role client (bypasses RLS)
    const serviceSupabase = await createServiceClient();

    // Set care_type based on role
    // Admin and doctor roles should always have NULL care_type
    // Nurse role defaults to '낮병원' if not specified
    let finalCareType: string | null = null;
    if (role === 'nurse') {
      finalCareType = care_type || '낮병원';
    }
    // Admin and doctor remain null (already initialized as null)

    const { error: profileError } = await serviceSupabase
      .from("profiles")
      .insert({
        id: data.user.id,
        email,
        name,
        role,
        care_type: finalCareType,
        phone: phone || null,
        organization_id,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail the signup if profile creation fails
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: "Account created successfully. Please check your email for verification.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}